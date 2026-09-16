// Contains seeded mock users for development
const mockUsers = [
  {
    id: "user-outlet-1",
    name: "The Commons Staff",
    email: "outlet1@rishihood.edu.in",
    role: "OUTLET",
    outletId: "outlet-1",
    onboardingCompleted: true,
    passwordHash: null,
  },
  {
    id: "user-outlet-2",
    name: "Brew & Bites Staff",
    email: "outlet2@rishihood.edu.in",
    role: "OUTLET",
    outletId: "outlet-2",
    onboardingCompleted: true,
    passwordHash: null,
  },
  {
    id: "user-student-1",
    name: "Student One",
    email: "student1@example.com",
    role: "STUDENT",
    onboardingCompleted: true,
    passwordHash: null,
  }
];

module.exports = mockUsers;