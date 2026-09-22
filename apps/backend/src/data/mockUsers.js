/**
 * Mock users for development/testing.
 * These will be replaced by a PostgreSQL-backed User table in Phase 03.
 */
const mockUsers = [
  {
    "id": "user-admin-1",
    "name": "Platform Admin",
    "email": "admin@rishihood.edu.in",
    "role": "SUPER_ADMIN",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "dev-admin",
    "name": "Adilreyaz",
    "email": "adilreyaz.admin@nosh.local",
    "role": "SUPER_ADMIN",
    "onboardingCompleted": true,
    "passwordHash": "$2b$12$eNYg96kD8o7KcEyswm5QRel6xBf3DUCgQIu44b.rtafkMzJ4X8Dk2",
    "status": "ACTIVE"
  },
  {
    "id": "user-outlet-1",
    "name": "Priya Sharma",
    "email": "outlet1@rishihood.edu.in",
    "role": "OUTLET_ADMIN",
    "outletId": "outlet-1",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "user-outlet-2",
    "name": "Rahul Verma",
    "email": "outlet2@rishihood.edu.in",
    "role": "OUTLET_ADMIN",
    "outletId": "outlet-2",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "user-outlet-3",
    "name": "Amit Singh",
    "email": "outlet3@rishihood.edu.in",
    "role": "OUTLET_ADMIN",
    "outletId": "outlet-3",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "user-outlet-4",
    "name": "Sneha Gupta",
    "email": "outlet4@rishihood.edu.in",
    "role": "OUTLET_ADMIN",
    "outletId": "outlet-4",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "user-outlet-5",
    "name": "Karan Patel",
    "email": "outlet5@rishihood.edu.in",
    "role": "OUTLET_ADMIN",
    "outletId": "outlet-5",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "dev-outlet",
    "name": "Adilreyaz Outlet",
    "email": "adilreyaz.outlet@nosh.local",
    "role": "OUTLET_ADMIN",
    "outletId": "mock-outlet-adil",
    "onboardingCompleted": true,
    "passwordHash": "$2b$12$DyaJApDYK3Upa5eHWHtCcOvU9tSAwPCeDpF1K5/e.PvkmNIRvfuI.",
    "status": "ACTIVE"
  },
  {
    "id": "staff-1",
    "name": "Ravi Kumar",
    "email": "staff1@outlet1.com",
    "role": "OUTLET_STAFF",
    "outletId": "outlet-1",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-2",
    "name": "Neha Reddy",
    "email": "staff2@outlet1.com",
    "role": "OUTLET_STAFF",
    "outletId": "outlet-1",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-3",
    "name": "Vikas Jain",
    "email": "staff1@outlet2.com",
    "role": "OUTLET_STAFF",
    "outletId": "outlet-2",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-4",
    "name": "Pooja Desai",
    "email": "staff2@outlet2.com",
    "role": "OUTLET_STAFF",
    "outletId": "outlet-2",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-5",
    "name": "Suresh Rao",
    "email": "staff1@outlet3.com",
    "role": "OUTLET_STAFF",
    "outletId": "outlet-3",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-6",
    "name": "Manish Tiwari",
    "email": "staff1@outlet4.com",
    "role": "OUTLET_STAFF",
    "outletId": "outlet-4",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-7",
    "name": "Anjali Menon",
    "email": "staff1@outlet5.com",
    "role": "OUTLET_STAFF",
    "outletId": "outlet-5",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-8",
    "name": "Dev Staff",
    "email": "staff1@devoutlet.com",
    "role": "OUTLET_STAFF",
    "outletId": "mock-outlet-adil",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "staff-9",
    "name": "Dev Staff 2",
    "email": "staff2@devoutlet.com",
    "role": "OUTLET_STAFF",
    "outletId": "mock-outlet-adil",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-1",
    "name": "Student 1",
    "email": "student1@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-2",
    "name": "Student 2",
    "email": "student2@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-3",
    "name": "Student 3",
    "email": "student3@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-4",
    "name": "Student 4",
    "email": "student4@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-5",
    "name": "Student 5",
    "email": "student5@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-6",
    "name": "Student 6",
    "email": "student6@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-7",
    "name": "Student 7",
    "email": "student7@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-8",
    "name": "Student 8",
    "email": "student8@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-9",
    "name": "Student 9",
    "email": "student9@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-10",
    "name": "Student 10",
    "email": "student10@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "SUSPENDED"
  },
  {
    "id": "student-11",
    "name": "Student 11",
    "email": "student11@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-12",
    "name": "Student 12",
    "email": "student12@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-13",
    "name": "Student 13",
    "email": "student13@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-14",
    "name": "Student 14",
    "email": "student14@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-15",
    "name": "Student 15",
    "email": "student15@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-16",
    "name": "Student 16",
    "email": "student16@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-17",
    "name": "Student 17",
    "email": "student17@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-18",
    "name": "Student 18",
    "email": "student18@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-19",
    "name": "Student 19",
    "email": "student19@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-20",
    "name": "Student 20",
    "email": "student20@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "SUSPENDED"
  },
  {
    "id": "student-21",
    "name": "Student 21",
    "email": "student21@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-22",
    "name": "Student 22",
    "email": "student22@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-23",
    "name": "Student 23",
    "email": "student23@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-24",
    "name": "Student 24",
    "email": "student24@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  },
  {
    "id": "student-25",
    "name": "Student 25",
    "email": "student25@example.com",
    "role": "STUDENT",
    "onboardingCompleted": true,
    "passwordHash": null,
    "status": "ACTIVE"
  }
];

module.exports = mockUsers;
