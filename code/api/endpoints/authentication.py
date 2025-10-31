"""
User Authentication API Endpoints

This module defines the REST API endpoints for user authentication and
account management in the Watershed Disturbance Mapping System.

Endpoints:
- POST /api/v1/auth/login/ - User login
- POST /api/v1/auth/logout/ - User logout
- POST /api/v1/auth/register/ - User registration
- POST /api/v1/auth/refresh/ - Refresh access token
- POST /api/v1/auth/forgot-password/ - Password reset request
- POST /api/v1/auth/reset-password/ - Password reset confirmation
- GET /api/v1/auth/profile/ - Get user profile
- PUT /api/v1/auth/profile/ - Update user profile
- POST /api/v1/auth/change-password/ - Change password
- POST /api/v1/auth/two-factor/ - Setup two-factor authentication
- GET /api/v1/auth/permissions/ - Get user permissions

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

import jwt
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid
import secrets
import hashlib

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.urls import reverse
from django.utils import timezone
from django.utils.encoding import force_bytes, force_text
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from rest_framework import status
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import AuthenticationFailed, ValidationError, NotFound
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken

from .models import User, Session, PasswordResetToken, TwoFactorAuth
from .serializers import (
    UserSerializer, RegistrationSerializer, LoginSerializer,
    PasswordChangeSerializer, PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer, TwoFactorSetupSerializer
)
from .permissions import IsOwner
from .utils.email_utils import send_email
from .utils.security_utils import (
    validate_password_strength, hash_password, verify_password,
    generate_secure_token, validate_token
)


class AuthenticationEndpoints:
    """Endpoint definitions for user authentication"""
    
    # Base path for authentication endpoints
    base_path = "/api/v1/auth"
    
    # JWT settings
    JWT_SETTINGS = {
        'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
        'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
        'ALGORITHM': 'HS256',
        'SIGNING_KEY': settings.SECRET_KEY,
        'VERIFYING_KEY': None,
        'AUTH_HEADER_TYPES': ('Bearer',),
        'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
        'USER_ID_FIELD': 'id',
        'USER_ID_CLAIM': 'user_id',
        'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
        'TOKEN_TYPE_CLAIM': 'token_type'
    }
    
    # Password reset token settings
    RESET_TOKEN_LIFETIME = timedelta(hours=1)
    
    # Rate limiting per endpoint
    rate_limits = {
        "login": "5/minute",
        "register": "3/hour",
        "forgot_password": "3/hour",
        "reset_password": "5/hour"
    }
    
    @staticmethod
    def user_login(request) -> Response:
        """
        POST /api/v1/auth/login/
        
        Authenticate user and return JWT tokens.
        
        Request Body:
        {
            "email": "user@example.com",
            "password": "secure_password",
            "remember_me": false
        }
        
        Responses:
        - 200: Success - Returns authentication tokens
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid credentials
        - 429: Too Many Requests - Rate limit exceeded
        """
        
        # Validate request data
        data = request.data
        
        if not data.get('email') or not data.get('password'):
            raise ValidationError({
                "email": "Email is required",
                "password": "Password is required"
            })
        
        # Authenticate user
        user = authenticate(request, email=data['email'], password=data['password'])
        
        if not user:
            raise AuthenticationFailed("Invalid email or password")
        
        if not user.is_active:
            raise AuthenticationFailed("User account is disabled")
        
        # Check if user has 2FA enabled
        if user.two_factor_enabled:
            # Return special response indicating 2FA required
            return Response({
                "requires_2fa": True,
                "user_id": user.id,
                "message": "Two-factor authentication required",
                "timestamp": timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        # Create session record
        session = Session.objects.create(
            user=user,
            token=str(refresh),
            ip_address=request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR')),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            expires_at=timezone.now() + AuthenticationEndpoints.JWT_SETTINGS['REFRESH_TOKEN_LIFETIME']
        )
        
        # Calculate token expiration
        remember_me = data.get('remember_me', False)
        if remember_me:
            # Extend refresh token lifetime to 90 days
            refresh.set_exp(lifetime=timedelta(days=90))
        
        # Log successful login
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"User login successful: {user.id} ({user.email})")
        
        response_data = {
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
            "token_type": "Bearer",
            "expires_in": int(AuthenticationEndpoints.JWT_SETTINGS['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.get_full_name(),
                "role": user.role,
                "permissions": user.get_permissions(),
                "subscription_tier": user.subscription_tier,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None
            },
            "session_id": session.id,
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def user_logout(request) -> Response:
        """
        POST /api/v1/auth/logout/
        
        Invalidate user session and refresh token.
        
        Request Body:
        {
            "refresh_token": "refresh_token_string"
        }
        
        Responses:
        - 200: Success - Logout completed
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing token
        """
        
        # Get refresh token from request
        refresh_token = request.data.get('refresh_token')
        
        if not refresh_token:
            raise ValidationError({"refresh_token": "Refresh token is required"})
        
        try:
            # Validate and blacklist refresh token
            token = RefreshToken(refresh_token)
            token.blacklist()
            
            # Logout from all sessions for this user
            if request.user.is_authenticated:
                Session.objects.filter(user=request.user).update(
                    revoked_at=timezone.now()
                )
                
                # Log logout event
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"User logout successful: {request.user.id}")
            
            return Response({
                "message": "Logout successful",
                "timestamp": timezone.now().isoformat()
            })
        
        except InvalidToken:
            raise AuthenticationFailed("Invalid refresh token")
    
    @staticmethod
    def user_registration(request) -> Response:
        """
        POST /api/v1/auth/register/
        
        Register a new user account.
        
        Request Body:
        {
            "email": "user@example.com",
            "password": "secure_password",
            "password_confirm": "secure_password",
            "full_name": "John Doe",
            "organization": "Environmental Agency",
            "role": "analyst",
            "accept_terms": true
        }
        
        Responses:
        - 201: Created - User registered successfully
        - 400: Bad Request - Invalid request data or validation errors
        - 409: Conflict - Email already exists
        """
        
        # Validate request data
        data = request.data
        
        required_fields = ['email', 'password', 'password_confirm']
        for field in required_fields:
            if not data.get(field):
                raise ValidationError({field: f"{field} is required"})
        
        # Validate email format
        try:
            validate_email(data['email'])
        except DjangoValidationError:
            raise ValidationError({"email": "Invalid email format"})
        
        # Validate password confirmation
        if data['password'] != data['password_confirm']:
            raise ValidationError({"password_confirm": "Passwords do not match"})
        
        # Validate password strength
        password_errors = validate_password_strength(data['password'])
        if password_errors:
            raise ValidationError({"password": password_errors})
        
        # Validate role
        valid_roles = ['viewer', 'analyst', 'admin']
        role = data.get('role', 'viewer')
        if role not in valid_roles:
            raise ValidationError({
                "role": f"Invalid role. Supported: {valid_roles}"
            })
        
        # Check if user already exists
        if User.objects.filter(email=data['email']).exists():
            raise ValidationError({
                "email": "An account with this email already exists"
            })
        
        try:
            with transaction.atomic():
                # Create user
                user_data = {
                    'email': data['email'],
                    'full_name': data.get('full_name', ''),
                    'organization': data.get('organization', ''),
                    'role': role,
                    'is_active': True,
                    'email_verified': False,
                    'created_at': timezone.now()
                }
                
                user = User.objects.create_user(**user_data)
                user.set_password(data['password'])
                user.save()
                
                # Generate email verification token
                verification_token = generate_secure_token()
                user.email_verification_token = verification_token
                user.email_verification_expires = timezone.now() + timedelta(hours=24)
                user.save()
                
                # Send verification email
                send_verification_email(user, verification_token)
                
                # Log registration
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"User registered: {user.id} ({user.email})")
                
                # Return user data (without sensitive information)
                response_data = {
                    "message": "User registered successfully. Please check your email for verification.",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                        "role": user.role,
                        "organization": user.organization,
                        "subscription_tier": user.subscription_tier,
                        "created_at": user.created_at.isoformat(),
                        "email_verified": user.email_verified
                    },
                    "next_steps": [
                        "Check your email for account verification",
                        "Complete your profile setup",
                        "Request access to watersheds"
                    ],
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error during user registration: {str(e)}")
            raise
    
    @staticmethod
    def refresh_token(request) -> Response:
        """
        POST /api/v1/auth/refresh/
        
        Refresh access token using refresh token.
        
        Request Body:
        {
            "refresh_token": "refresh_token_string"
        }
        
        Responses:
        - 200: Success - Returns new access token
        - 401: Unauthorized - Invalid or expired refresh token
        """
        
        # Get refresh token from request
        refresh_token = request.data.get('refresh_token')
        
        if not refresh_token:
            raise ValidationError({"refresh_token": "Refresh token is required"})
        
        try:
            # Validate refresh token
            token = RefreshToken(refresh_token)
            user_id = token['user_id']
            
            # Get user
            user = User.objects.get(id=user_id)
            
            if not user.is_active:
                raise AuthenticationFailed("User account is disabled")
            
            # Check if session is valid
            session = Session.objects.filter(
                user=user, token=refresh_token, revoked_at__isnull=True
            ).first()
            
            if not session or session.expires_at <= timezone.now():
                raise AuthenticationFailed("Session expired")
            
            # Generate new tokens
            new_refresh = RefreshToken.for_user(user)
            
            # Update session with new refresh token
            session.token = str(new_refresh)
            session.expires_at = timezone.now() + AuthenticationEndpoints.JWT_SETTINGS['REFRESH_TOKEN_LIFETIME']
            session.save()
            
            response_data = {
                "access_token": str(new_refresh.access_token),
                "refresh_token": str(new_refresh),
                "token_type": "Bearer",
                "expires_in": int(AuthenticationEndpoints.JWT_SETTINGS['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except (InvalidToken, User.DoesNotExist, Session.DoesNotExist):
            raise AuthenticationFailed("Invalid or expired refresh token")
    
    @staticmethod
    def get_profile(request) -> Response:
        """
        GET /api/v1/auth/profile/
        
        Get current user profile information.
        
        Responses:
        - 200: Success - Returns user profile
        - 401: Unauthorized - Invalid or missing authentication
        """
        
        if not request.user.is_authenticated:
            raise AuthenticationFailed("Authentication required")
        
        # Get user profile with additional information
        user = request.user
        
        # Get user's watersheds
        owned_watersheds = user.watersheds.count()
        analyst_watersheds = user.analyst_watersheds.count()
        viewer_watersheds = user.viewer_watersheds.count()
        
        # Get recent activity
        recent_sessions = Session.objects.filter(
            user=user, revoked_at__isnull=True
        ).order_by('-created_at')[:5]
        
        # Get account statistics
        total_detections = 0
        validated_detections = 0
        if user.watersheds.exists():
            from .models import ChangeDetection
            total_detections = ChangeDetection.objects.filter(
                watershed__owner=user
            ).count()
            validated_detections = ChangeDetection.objects.filter(
                watershed__owner=user,
                validation_feedback__isnull=False
            ).distinct().count()
        
        response_data = {
            "profile": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "organization": user.organization,
                "role": user.role,
                "subscription_tier": user.subscription_tier,
                "email_verified": user.email_verified,
                "two_factor_enabled": user.two_factor_enabled,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "account_statistics": {
                    "owned_watersheds": owned_watersheds,
                    "analyst_watersheds": analyst_watersheds,
                    "viewer_watersheds": viewer_watersheds,
                    "total_detections": total_detections,
                    "validated_detections": validated_detections
                }
            },
            "permissions": user.get_permissions(),
            "active_sessions": [
                {
                    "session_id": session.id,
                    "created_at": session.created_at.isoformat(),
                    "expires_at": session.expires_at.isoformat(),
                    "ip_address": session.ip_address,
                    "user_agent": session.user_agent[:100] + "..." if len(session.user_agent) > 100 else session.user_agent
                }
                for session in recent_sessions
            ],
            "preferences": {
                "notifications": user.notification_settings or {},
                "display_settings": user.display_settings or {}
            },
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def update_profile(request) -> Response:
        """
        PUT /api/v1/auth/profile/
        
        Update user profile information.
        
        Request Body:
        {
            "full_name": "John Doe",
            "organization": "Environmental Agency",
            "preferences": {
                "notifications": {...},
                "display_settings": {...}
            }
        }
        
        Responses:
        - 200: Success - Profile updated successfully
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing authentication
        """
        
        if not request.user.is_authenticated:
            raise AuthenticationFailed("Authentication required")
        
        # Validate request data
        data = request.data
        
        try:
            with transaction.atomic():
                # Update user fields
                if 'full_name' in data:
                    request.user.full_name = data['full_name']
                
                if 'organization' in data:
                    request.user.organization = data['organization']
                
                # Update preferences
                if 'preferences' in data:
                    preferences = data['preferences']
                    
                    if 'notifications' in preferences:
                        if request.user.notification_settings is None:
                            request.user.notification_settings = {}
                        request.user.notification_settings.update(preferences['notifications'])
                    
                    if 'display_settings' in preferences:
                        if request.user.display_settings is None:
                            request.user.display_settings = {}
                        request.user.display_settings.update(preferences['display_settings'])
                
                request.user.updated_at = timezone.now()
                request.user.save()
                
                # Log profile update
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Profile updated: user {request.user.id}")
                
                # Return updated profile
                serializer = UserSerializer(request.user)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Profile updated successfully",
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error updating profile: {str(e)}")
            raise
    
    @staticmethod
    def change_password(request) -> Response:
        """
        POST /api/v1/auth/change-password/
        
        Change user password.
        
        Request Body:
        {
            "current_password": "old_password",
            "new_password": "new_password",
            "new_password_confirm": "new_password"
        }
        
        Responses:
        - 200: Success - Password changed successfully
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid current password
        """
        
        if not request.user.is_authenticated:
            raise AuthenticationFailed("Authentication required")
        
        # Validate request data
        data = request.data
        
        required_fields = ['current_password', 'new_password', 'new_password_confirm']
        for field in required_fields:
            if not data.get(field):
                raise ValidationError({field: f"{field} is required"})
        
        # Verify current password
        if not request.user.check_password(data['current_password']):
            raise ValidationError({"current_password": "Current password is incorrect"})
        
        # Validate new password confirmation
        if data['new_password'] != data['new_password_confirm']:
            raise ValidationError({"new_password_confirm": "New passwords do not match"})
        
        # Validate new password strength
        password_errors = validate_password_strength(data['new_password'])
        if password_errors:
            raise ValidationError({"new_password": password_errors})
        
        try:
            with transaction.atomic():
                # Update password
                request.user.set_password(data['new_password'])
                request.user.save()
                
                # Revoke all existing sessions
                Session.objects.filter(user=request.user).update(
                    revoked_at=timezone.now()
                )
                
                # Log password change
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Password changed: user {request.user.id}")
                
                return Response({
                    "message": "Password changed successfully. Please login again.",
                    "timestamp": timezone.now().isoformat()
                })
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error changing password: {str(e)}")
            raise
    
    @staticmethod
    def request_password_reset(request) -> Response:
        """
        POST /api/v1/auth/forgot-password/
        
        Request password reset token via email.
        
        Request Body:
        {
            "email": "user@example.com"
        }
        
        Responses:
        - 200: Success - Password reset email sent
        - 404: Not Found - Email not found
        """
        
        # Validate request data
        data = request.data
        
        if not data.get('email'):
            raise ValidationError({"email": "Email is required"})
        
        # Validate email format
        try:
            validate_email(data['email'])
        except DjangoValidationError:
            raise ValidationError({"email": "Invalid email format"})
        
        # Get user
        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            # Don't reveal if email exists or not for security
            return Response({
                "message": "If an account with this email exists, a password reset link has been sent.",
                "timestamp": timezone.now().isoformat()
            })
        
        try:
            # Generate password reset token
            reset_token = generate_secure_token()
            reset_token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
            
            # Store password reset token
            PasswordResetToken.objects.filter(user=user).delete()  # Remove old tokens
            PasswordResetToken.objects.create(
                user=user,
                token_hash=reset_token_hash,
                expires_at=timezone.now() + AuthenticationEndpoints.RESET_TOKEN_LIFETIME,
                created_at=timezone.now()
            )
            
            # Generate reset link
            reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}&uid={user.id}"
            
            # Send reset email
            send_password_reset_email(user, reset_link)
            
            # Log password reset request
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Password reset requested: user {user.id}")
            
            return Response({
                "message": "If an account with this email exists, a password reset link has been sent.",
                "timestamp": timezone.now().isoformat()
            })
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error processing password reset request: {str(e)}")
            raise


def send_verification_email(user: User, token: str) -> None:
    """Send email verification email"""
    verification_link = f"{settings.FRONTEND_URL}/verify-email?token={token}&uid={user.id}"
    
    email_content = f"""
    Welcome to the Watershed Disturbance Mapping System!
    
    Please click the link below to verify your email address:
    {verification_link}
    
    This link will expire in 24 hours.
    
    If you didn't create this account, please ignore this email.
    """
    
    send_email(
        to_email=user.email,
        subject="Verify Your Email - Watershed Disturbance Mapping System",
        content=email_content
    )


def send_password_reset_email(user: User, reset_link: str) -> None:
    """Send password reset email"""
    email_content = f"""
    Password Reset Request
    
    Click the link below to reset your password:
    {reset_link}
    
    This link will expire in 1 hour.
    
    If you didn't request this password reset, please ignore this email.
    """
    
    send_email(
        to_email=user.email,
        subject="Password Reset - Watershed Disturbance Mapping System",
        content=email_content
    )


# API endpoint registry
AUTH_ENDPOINT_PATHS = {
    'login': '/api/v1/auth/login/',
    'logout': '/api/v1/auth/logout/',
    'register': '/api/v1/auth/register/',
    'refresh': '/api/v1/auth/refresh/',
    'forgot_password': '/api/v1/auth/forgot-password/',
    'profile': '/api/v1/auth/profile/',
    'change_password': '/api/v1/auth/change-password/'
}


class AuthenticationAPIViewSet(ViewSet):
    """Django REST Framework ViewSet for Authentication endpoints"""
    
    permission_classes = []  # No permissions required for auth endpoints
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        """Handle user login"""
        return AuthenticationEndpoints.user_login(request)
    
    @action(detail=False, methods=['post'])
    def logout(self, request):
        """Handle user logout"""
        return AuthenticationEndpoints.user_logout(request)
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        """Handle user registration"""
        return AuthenticationEndpoints.user_registration(request)
    
    @action(detail=False, methods=['post'])
    def refresh(self, request):
        """Handle token refresh"""
        return AuthenticationEndpoints.refresh_token(request)
    
    @action(detail=False, methods=['post'])
    def forgot_password(self, request):
        """Handle password reset request"""
        return AuthenticationEndpoints.request_password_reset(request)
    
    @action(detail=False, methods=['get', 'put'])
    def profile(self, request):
        """Handle user profile operations"""
        if request.method == 'GET':
            return AuthenticationEndpoints.get_profile(request)
        elif request.method == 'PUT':
            return AuthenticationEndpoints.update_profile(request)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Handle password change"""
        return AuthenticationEndpoints.change_password(request)