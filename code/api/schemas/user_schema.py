"""
User Authentication and Account Management Schemas

This module defines the data schemas and models for user authentication
and account management in the Watershed Disturbance Mapping System API.

Schemas:
- User model and authentication
- Role-based access control
- Session management
- Password security
- Two-factor authentication

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
import uuid
import secrets
import hashlib

from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager
from django.contrib.auth.base_user import AbstractBaseUser
from django.core.validators import MinLengthValidator
from django.utils import timezone
from django.conf import settings


class User(AbstractUser):
    """
    Extended user model with additional fields for the watershed system.
    
    Extends Django's built-in User model with:
    - Enhanced profile information
    - Role-based permissions
    - Subscription tiers
    - Security features
    """
    
    # Custom ID field
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique user identifier"
    )
    
    # Enhanced profile information
    full_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="User's full name"
    )
    
    organization = models.CharField(
        max_length=255,
        blank=True,
        help_text="User's organization or institution"
    )
    
    # Role-based access control
    ROLE_CHOICES = [
        ('viewer', 'Viewer'),
        ('analyst', 'Analyst'),
        ('admin', 'Administrator')
    ]
    
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='viewer',
        help_text="User role determining access level"
    )
    
    # Subscription and access management
    SUBSCRIPTION_TIERS = [
        ('free', 'Free Tier'),
        ('analyst', 'Analyst Tier'),
        ('admin', 'Admin Tier'),
        ('enterprise', 'Enterprise Tier')
    ]
    
    subscription_tier = models.CharField(
        max_length=20,
        choices=SUBSCRIPTION_TIERS,
        default='free',
        help_text="User subscription tier"
    )
    
    # Profile verification
    email_verified = models.BooleanField(
        default=False,
        help_text="Whether email address has been verified"
    )
    
    profile_complete = models.BooleanField(
        default=False,
        help_text="Whether user profile is complete"
    )
    
    # Email verification
    email_verification_token = models.CharField(
        max_length=255,
        blank=True,
        help_text="Email verification token"
    )
    
    email_verification_expires = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Email verification token expiration"
    )
    
    # Password reset
    password_reset_token = models.CharField(
        max_length=255,
        blank=True,
        help_text="Password reset token"
    )
    
    password_reset_expires = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Password reset token expiration"
    )
    
    # Two-factor authentication
    two_factor_enabled = models.BooleanField(
        default=False,
        help_text="Whether two-factor authentication is enabled"
    )
    
    two_factor_secret = models.CharField(
        max_length=255,
        blank=True,
        help_text="Two-factor authentication secret"
    )
    
    two_factor_backup_codes = models.JSONField(
        default=list,
        blank=True,
        help_text="Backup codes for two-factor authentication"
    )
    
    # Session management
    last_login_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of last login"
    )
    
    login_attempts = models.IntegerField(
        default=0,
        help_text="Number of failed login attempts"
    )
    
    locked_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Account lock expiration time"
    )
    
    # Preferences and settings
    notification_settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="User notification preferences"
    )
    
    display_settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="User interface display preferences"
    )
    
    # Rate limiting
    custom_rate_limits = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom rate limits for this user"
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Account creation timestamp"
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Last update timestamp"
    )
    
    # Override Django's default username field behavior
    username = None
    email = models.EmailField(
        unique=True,
        help_text="User email address (used as primary identifier)"
    )
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['subscription_tier']),
            models.Index(fields=['email_verified']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.email} ({self.role})"
    
    def get_full_name(self) -> str:
        """Get user's full name or email as fallback"""
        return self.full_name or self.email
    
    def get_short_name(self) -> str:
        """Get user's short name or email as fallback"""
        return self.full_name.split()[0] if self.full_name else self.email.split('@')[0]
    
    def get_permissions(self) -> List[str]:
        """Get list of user permissions based on role"""
        base_permissions = {
            'viewer': [
                'watershed.view',
                'detection.view',
                'export.create',
                'export.view_own'
            ],
            'analyst': [
                'watershed.view',
                'watershed.manage',
                'detection.view',
                'detection.analyze',
                'detection.validate',
                'export.create',
                'export.view_own',
                'export.view_organization'
            ],
            'admin': [
                'watershed.all',
                'detection.all',
                'user.manage',
                'export.all',
                'system.admin'
            ]
        }
        
        # Get base permissions for role
        permissions = base_permissions.get(self.role, base_permissions['viewer'])
        
        # Add subscription-based permissions
        if self.subscription_tier in ['admin', 'enterprise']:
            permissions.extend([
                'advanced.analytics',
                'bulk.processing',
                'priority.support'
            ])
        
        return permissions
    
    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        return permission in self.get_permissions()
    
    def can_access_watershed(self, watershed) -> bool:
        """Check if user can access specific watershed"""
        if self.is_superuser:
            return True
        
        return (
            watershed.owner == self or
            self in watershed.analysts.all() or
            self in watershed.viewers.all()
        )
    
    def is_locked(self) -> bool:
        """Check if account is locked"""
        if not self.locked_until:
            return False
        return timezone.now() < self.locked_until
    
    def lock_account(self, duration_hours: int = 24) -> None:
        """Lock user account for specified duration"""
        self.locked_until = timezone.now() + timedelta(hours=duration_hours)
        self.save()
    
    def unlock_account(self) -> None:
        """Unlock user account"""
        self.locked_until = None
        self.login_attempts = 0
        self.save()
    
    def increment_login_attempts(self) -> None:
        """Increment failed login attempts"""
        self.login_attempts += 1
        
        # Lock account after 5 failed attempts
        if self.login_attempts >= 5:
            self.lock_account()
        
        self.save()
    
    def reset_login_attempts(self) -> None:
        """Reset login attempt counter"""
        self.login_attempts = 0
        self.save()
    
    def generate_verification_token(self) -> str:
        """Generate email verification token"""
        token = secrets.token_urlsafe(32)
        self.email_verification_token = hashlib.sha256(token.encode()).hexdigest()
        self.email_verification_expires = timezone.now() + timedelta(hours=24)
        self.save()
        return token
    
    def verify_email(self, token: str) -> bool:
        """Verify email with provided token"""
        if not self.email_verification_token:
            return False
        
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        if (token_hash == self.email_verification_token and
            self.email_verification_expires and
            timezone.now() <= self.email_verification_expires):
            
            self.email_verified = True
            self.email_verification_token = ''
            self.email_verification_expires = None
            self.save()
            return True
        
        return False
    
    def generate_password_reset_token(self) -> str:
        """Generate password reset token"""
        token = secrets.token_urlsafe(32)
        self.password_reset_token = hashlib.sha256(token.encode()).hexdigest()
        self.password_reset_expires = timezone.now() + timedelta(hours=1)
        self.save()
        return token
    
    def verify_password_reset_token(self, token: str) -> bool:
        """Verify password reset token"""
        if not self.password_reset_token:
            return False
        
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return (token_hash == self.password_reset_token and
                self.password_reset_expires and
                timezone.now() <= self.password_reset_expires)
    
    def clear_password_reset_token(self) -> None:
        """Clear password reset token"""
        self.password_reset_token = ''
        self.password_reset_expires = None
        self.save()


class UserProfile(models.Model):
    """
    Extended user profile information.
    
    Stores additional profile data that doesn't need to be
    in the main User model.
    """
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    
    # Professional information
    job_title = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    
    # Address information
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state_province = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    
    # Professional background
    expertise_areas = models.JSONField(
        default=list,
        blank=True,
        help_text="Areas of expertise"
    )
    
    years_experience = models.IntegerField(
        null=True,
        blank=True,
        help_text="Years of relevant experience"
    )
    
    certifications = models.JSONField(
        default=list,
        blank=True,
        help_text="Professional certifications"
    )
    
    # Account preferences
    preferred_language = models.CharField(
        max_length=10,
        default='en',
        help_text="Preferred interface language"
    )
    
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        help_text="User's timezone"
    )
    
    # Privacy settings
    profile_visibility = models.CharField(
        max_length=20,
        choices=[
            ('public', 'Public'),
            ('organization', 'Organization Only'),
            ('private', 'Private')
        ],
        default='organization',
        help_text="Profile visibility settings"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_profiles'
    
    def __str__(self):
        return f"Profile for {self.user.email}"


class Session(models.Model):
    """
    Model for tracking user sessions and authentication tokens.
    
    Provides session management for security and user experience.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='sessions'
    )
    
    # Session identification
    token = models.TextField(
        help_text="JWT refresh token or session token"
    )
    
    # Session metadata
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="User's IP address"
    )
    
    user_agent = models.TextField(
        max_length=500,
        help_text="User agent string"
    )
    
    device_info = models.JSONField(
        default=dict,
        blank=True,
        help_text="Device and browser information"
    )
    
    # Session lifecycle
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Session creation time"
    )
    
    last_activity = models.DateTimeField(
        auto_now=True,
        help_text="Last activity timestamp"
    )
    
    expires_at = models.DateTimeField(
        help_text="Session expiration time"
    )
    
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Session revocation time"
    )
    
    is_active = models.BooleanField(
        default=True,
        help_text="Whether session is currently active"
    )
    
    class Meta:
        db_table = 'user_sessions'
        ordering = ['-last_activity']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['token']),
            models.Index(fields=['created_at']),
            models.Index(fields=['expires_at']),
        ]
    
    def __str__(self):
        return f"Session {self.id} - {self.user.email}"
    
    def is_expired(self) -> bool:
        """Check if session is expired"""
        return timezone.now() > self.expires_at
    
    def revoke(self) -> None:
        """Revoke the session"""
        self.revoked_at = timezone.now()
        self.is_active = False
        self.save()
    
    def refresh_activity(self) -> None:
        """Update last activity timestamp"""
        self.last_activity = timezone.now()
        self.save()


class PasswordResetToken(models.Model):
    """
    Model for storing password reset tokens.
    
    Provides secure password reset functionality with expiration.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    
    token_hash = models.CharField(
        max_length=64,
        help_text="SHA256 hash of the reset token"
    )
    
    expires_at = models.DateTimeField(
        help_text="Token expiration time"
    )
    
    used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Token usage time"
    )
    
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address that requested reset"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Token creation time"
    )
    
    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['used_at']),
        ]
    
    def __str__(self):
        return f"Password reset token for {self.user.email}"
    
    def is_expired(self) -> bool:
        """Check if token is expired"""
        return timezone.now() > self.expires_at
    
    def is_used(self) -> bool:
        """Check if token has been used"""
        return self.used_at is not None
    
    def mark_used(self) -> None:
        """Mark token as used"""
        self.used_at = timezone.now()
        self.save()


class TwoFactorAuth(models.Model):
    """
    Model for two-factor authentication configuration.
    
    Stores TOTP secrets, backup codes, and authentication settings.
    """
    
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='two_factor_auth'
    )
    
    # TOTP configuration
    secret = models.CharField(
        max_length=32,
        help_text="TOTP secret key"
    )
    
    is_enabled = models.BooleanField(
        default=False,
        help_text="Whether 2FA is enabled"
    )
    
    # Backup codes
    backup_codes = models.JSONField(
        default=list,
        help_text="List of backup codes"
    )
    
    # Authentication attempts
    failed_attempts = models.IntegerField(
        default=0,
        help_text="Number of failed 2FA attempts"
    )
    
    locked_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="2FA lock expiration time"
    )
    
    # Settings
    remember_device_days = models.IntegerField(
        default=30,
        help_text="Number of days to remember trusted device"
    )
    
    # Timestamps
    enabled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="2FA enablement timestamp"
    )
    
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last 2FA usage timestamp"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'two_factor_auth'
    
    def __str__(self):
        return f"2FA for {self.user.email}"
    
    def is_locked(self) -> bool:
        """Check if 2FA is locked due to failed attempts"""
        if not self.locked_until:
            return False
        return timezone.now() < self.locked_until
    
    def lock(self, duration_minutes: int = 15) -> None:
        """Lock 2FA for specified duration"""
        self.locked_until = timezone.now() + timedelta(minutes=duration_minutes)
        self.save()
    
    def unlock(self) -> None:
        """Unlock 2FA"""
        self.locked_until = None
        self.failed_attempts = 0
        self.save()
    
    def increment_failed_attempts(self) -> None:
        """Increment failed 2FA attempts"""
        self.failed_attempts += 1
        
        # Lock after 3 failed attempts
        if self.failed_attempts >= 3:
            self.lock()
        
        self.save()
    
    def reset_failed_attempts(self) -> None:
        """Reset failed attempt counter"""
        self.failed_attempts = 0
        self.save()


# Schema validation functions
def validate_user_registration_schema(data: Dict[str, Any]) -> bool:
    """
    Validate user registration data against schema requirements.
    
    Args:
        data: User registration data dictionary
        
    Returns:
        bool: True if valid, False otherwise
        
    Raises:
        ValueError: If validation fails
    """
    from django.core.validators import validate_email
    
    required_fields = ['email', 'password']
    
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Required field '{field}' is missing")
    
    # Validate email format
    try:
        validate_email(data['email'])
    except:
        raise ValueError("Invalid email format")
    
    # Validate password strength
    password = data['password']
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    
    # Check for common password patterns
    common_patterns = ['123456', 'password', 'qwerty', 'admin']
    if any(pattern in password.lower() for pattern in common_patterns):
        raise ValueError("Password is too common")
    
    # Validate role if provided
    if 'role' in data:
        valid_roles = [choice[0] for choice in User.ROLE_CHOICES]
        if data['role'] not in valid_roles:
            raise ValueError(f"Invalid role. Must be one of: {valid_roles}")
    
    return True


def validate_user_profile_schema(data: Dict[str, Any]) -> bool:
    """
    Validate user profile data against schema requirements.
    
    Args:
        data: User profile data dictionary
        
    Returns:
        bool: True if valid, False otherwise
    """
    # Validate phone number format (basic)
    if 'phone' in data and data['phone']:
        phone = data['phone'].strip()
        if not (phone.replace('+', '').replace('-', '').replace('(', '').replace(')', '').replace(' ', '').isdigit() and len(phone) >= 10):
            raise ValueError("Invalid phone number format")
    
    # Validate years of experience
    if 'years_experience' in data:
        years = data['years_experience']
        if years < 0 or years > 50:
            raise ValueError("Years of experience must be between 0 and 50")
    
    # Validate timezone
    if 'timezone' in data:
        import pytz
        try:
            pytz.timezone(data['timezone'])
        except pytz.UnknownTimeZoneError:
            raise ValueError("Invalid timezone")
    
    return True


# Export schema definitions
USER_EXPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "format": "uuid"},
        "email": {"type": "string", "format": "email"},
        "full_name": {"type": "string"},
        "organization": {"type": "string"},
        "role": {"type": "string"},
        "subscription_tier": {"type": "string"},
        "email_verified": {"type": "boolean"},
        "profile_complete": {"type": "boolean"},
        "created_at": {"type": "string", "format": "date-time"},
        "last_login": {"type": "string", "format": "date-time"},
        "permissions": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": [
        "id", "email", "role", "subscription_tier"
    ]
}