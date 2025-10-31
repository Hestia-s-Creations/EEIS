const request = require('supertest');
const { app, server } = require('../server');
const { User } = require('../models');
const jwt = require('jsonwebtoken');

describe('Watershed Disturbance Mapping API', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'viewer'
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) {
      await testUser.destroy();
    }
    if (server) {
      server.close();
    }
  });

  describe('Health Check', () => {
    test('GET /health should return service status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('API Documentation', () => {
    test('GET /api-docs should serve Swagger UI', async () => {
      const response = await request(app)
        .get('/api-docs')
        .expect(200);

      expect(response.text).toContain('swagger');
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/register should create new user', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'NewUser123!',
        firstName: 'New',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(userData.email);

      // Cleanup
      const createdUser = await User.findOne({ where: { email: userData.email } });
      if (createdUser) {
        await createdUser.destroy();
      }
    });

    test('POST /api/auth/login should authenticate user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    test('GET /api/auth/me should return current user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toHaveProperty('id', testUser.id);
    });
  });

  describe('Watersheds API', () => {
    test('GET /api/watersheds should return empty list for new database', async () => {
      const response = await request(app)
        .get('/api/watersheds')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.watersheds).toEqual([]);
      expect(response.body.data.pagination.totalItems).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('POST /api/auth/register should handle duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          email: testUser.email, // Same as testUser
          password: 'Password123!',
          firstName: 'Duplicate',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body.error).toBe('User with this email or username already exists');
    });

    test('GET /api/watersheds/:id should return 404 for non-existent watershed', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/watersheds/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Watershed not found');
    });

    test('API should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/watersheds')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    test('API should handle invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Authentication failed');
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests under rate limit', async () => {
      const promises = Array(5).fill().map(() =>
        request(app)
          .get('/health')
          .expect(200)
      );

      await Promise.all(promises);
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser2',
          email: 'invalid-email',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    test('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser3',
          email: 'testuser3@example.com',
          password: 'weak',
          firstName: 'Test',
          lastName: 'User'
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });
});
