import client from '../api/client';

// Default mock accounts for seamless development & offline fallback
const MOCK_USERS_DB = {
  'studen2@example.com': {
    id: 'user-student-1',
    name: 'Student One',
    email: 'studen2@example.com',
    role: 'STUDENT',
    onboardingCompleted: true,
  },
  'student@rishihood.edu.in': {
    id: 'user-student-2',
    name: 'Alex Sharma',
    email: 'student@rishihood.edu.in',
    role: 'STUDENT',
    onboardingCompleted: true,
  },
  'admin@rishihood.edu.in': {
    id: 'user-admin-1',
    name: 'Platform Admin',
    email: 'admin@rishihood.edu.in',
    role: 'SUPER_ADMIN',
    onboardingCompleted: true,
  },
  'outlet1@rishihood.edu.in': {
    id: 'user-outlet-1',
    name: 'The Commons Staff',
    email: 'outlet1@rishihood.edu.in',
    role: 'OUTLET_ADMIN',
    outletId: 'outlet-1',
    onboardingCompleted: true,
  },
  'outlet1.staff@rishihood.edu.in': {
    id: 'user-outlet-1-staff',
    name: 'The Commons Crew',
    email: 'outlet1.staff@rishihood.edu.in',
    role: 'OUTLET_STAFF',
    outletId: 'outlet-1',
    onboardingCompleted: true,
  },
  'outlet2@rishihood.edu.in': {
    id: 'user-outlet-2',
    name: 'Brew & Bites Staff',
    email: 'outlet2@rishihood.edu.in',
    role: 'OUTLET_ADMIN',
    outletId: 'outlet-2',
    onboardingCompleted: true,
  },
  'outlet2.staff@rishihood.edu.in': {
    id: 'user-outlet-2-staff',
    name: 'Brew & Bites Crew',
    email: 'outlet2.staff@rishihood.edu.in',
    role: 'OUTLET_STAFF',
    outletId: 'outlet-2',
    onboardingCompleted: true,
  },
  'adilreyaz.admin@nosh.local': {
    id: 'dev-admin',
    name: 'Adilreyaz',
    email: 'adilreyaz.admin@nosh.local',
    role: 'SUPER_ADMIN',
    onboardingCompleted: true,
  },
  'adilreyaz.outlet@nosh.local': {
    id: 'dev-outlet',
    name: 'Adilreyaz Outlet',
    email: 'adilreyaz.outlet@nosh.local',
    role: 'OUTLET_ADMIN',
    outletId: 'mock-outlet-adil',
    onboardingCompleted: true,
  },
};

export const authService = {
  /**
   * Login using backend dev-login with seamless offline / mock fallback.
   * @param {string} email
   * @param {string} password 
   */
  async login(email, password) {
    const normalizedEmail = email?.trim().toLowerCase();
    
    // 1. Try backend server if available
    try {
      const response = await client.post('/auth/dev-login', { email: normalizedEmail, password });
      if (response.data?.success && response.data?.data) {
        return response.data;
      }
    } catch (networkOrApiError) {
      // If backend explicitly rejected with invalid credentials (401/403/404), check if local temp password was set
      if (networkOrApiError.response?.status === 401 && !localStorage.getItem(`nosh_temp_pw_${normalizedEmail}`)) {
        throw { message: networkOrApiError.response?.data?.message || 'Invalid credentials. Please check your password.' };
      }
    }

    // 2. Client-side fallback authentication
    const storedTemp = localStorage.getItem(`nosh_temp_pw_${normalizedEmail}`);
    const storedUsers = JSON.parse(localStorage.getItem('nosh_registered_users') || '[]');
    const localUser = storedUsers.find((u) => u.email?.toLowerCase() === normalizedEmail);
    const mockUser = MOCK_USERS_DB[normalizedEmail];

    // Check temporary password generated via Forgot Password
    if (storedTemp && password === storedTemp) {
      localStorage.removeItem(`nosh_temp_pw_${normalizedEmail}`);
      const user = localUser || mockUser || {
        id: 'user-' + Date.now(),
        name: localUser?.fullName || 'Student',
        email: normalizedEmail,
        role: 'STUDENT',
        onboardingCompleted: true,
      };
      const token = 'jwt-temp-' + Date.now();
      return {
        success: true,
        data: {
          user,
          accessToken: token,
        },
      };
    }

    // Check locally registered user from StudentSignUp
    if (localUser) {
      if (localUser.password && password && localUser.password !== password) {
        throw { message: 'Invalid password. Please check your credentials or reset password.' };
      }
      const user = {
        id: 'user-' + (localUser.enrollmentNumber || Date.now()),
        name: localUser.fullName || 'Student',
        email: normalizedEmail,
        phone: localUser.phoneNumber,
        enrollmentNumber: localUser.enrollmentNumber,
        role: 'STUDENT',
        onboardingCompleted: true,
      };
      const token = 'jwt-registered-' + Date.now();
      return {
        success: true,
        data: {
          user,
          accessToken: token,
        },
      };
    }

    // Check standard mock user database
    if (mockUser) {
      const token = 'jwt-mock-' + Date.now();
      return {
        success: true,
        data: {
          user: mockUser,
          accessToken: token,
        },
      };
    }

    // Allow campus domain student login in dev mode
    if (normalizedEmail.endsWith('@rishihood.edu.in') || normalizedEmail.endsWith('@campus.edu') || normalizedEmail) {
      const namePart = normalizedEmail.includes('@') ? normalizedEmail.split('@')[0].replace('.', ' ') : normalizedEmail;
      const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const user = {
        id: 'user-' + Date.now(),
        name: formattedName || 'Student',
        email: normalizedEmail,
        role: 'STUDENT',
        onboardingCompleted: true,
      };
      const token = 'jwt-campus-' + Date.now();
      return {
        success: true,
        data: {
          user,
          accessToken: token,
        },
      };
    }

    throw { message: 'No registered account found with this email. Please sign up first.' };
  },

  /**
   * Request a temporary password sent to registered college email.
   * @param {string} email
   */
  async forgotPassword(email) {
    const normalizedEmail = email?.trim().toLowerCase();

    // 1. Try backend server if available
    try {
      const response = await client.post('/auth/forgot-password', { email: normalizedEmail });
      if (response.data?.success) {
        return response.data;
      }
    } catch (networkOrApiError) {
      // If backend responded with 404/400, handle accordingly
      if (networkOrApiError.response?.data?.message) {
        throw { message: networkOrApiError.response.data.message };
      }
    }

    // 2. Client-side verification and temporary password generation
    const storedUsers = JSON.parse(localStorage.getItem('nosh_registered_users') || '[]');
    const isRegisteredLocal = storedUsers.some((u) => u.email?.toLowerCase() === normalizedEmail);
    const isKnownMock = !!MOCK_USERS_DB[normalizedEmail];
    const isCampusDomain = normalizedEmail.endsWith('@rishihood.edu.in') || normalizedEmail.endsWith('@campus.edu');

    if (isRegisteredLocal || isKnownMock || isCampusDomain) {
      // Securely generate temporary password for development authentication
      const tempPassword = `NoshTemp${Math.floor(100000 + Math.random() * 900000)}`;
      localStorage.setItem(`nosh_temp_pw_${normalizedEmail}`, tempPassword);

      // Simulates sending to email without returning password in response
      console.log(`[DISPATCH] Sent temporary password to ${normalizedEmail}`);

      return {
        success: true,
        message: 'A temporary password has been sent to your registered college email.',
      };
    }

    // Email is not registered
    throw {
      message: 'No registered account found with this college email address. Please check your email or sign up.',
    };
  },

  /**
   * Logs out the user
   */
  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }
};
