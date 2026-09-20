IMPORTANT — FRONTEND PROJECT STRUCTURE RULES

You are working on the Campus Food frontend.

The frontend uses:
- React
- JavaScript
- Vite
- React Router
- Tailwind CSS

You MUST follow the existing folder structure strictly.

Do NOT create files randomly in src/.
Do NOT put pages inside components/.
Do NOT put reusable components inside pages/.
Do NOT put API calls directly inside UI components unless explicitly required.
Do NOT create duplicate folders with different names.
Before creating a new file, check whether an appropriate folder already exists.

==================================================
FRONTEND STRUCTURE
==================================================

apps/frontend/
│
├── public/
│
├── src/
│   │
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── auth/
│   │   ├── food/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── orders/
│   │   ├── notifications/
│   │   ├── outlet/
│   │   ├── admin/
│   │   └── common/
│   │
│   ├── pages/
│   │   ├── auth/
│   │   ├── student/
│   │   ├── outlet/
│   │   └── admin/
│   │
│   ├── layouts/
│   │   ├── AuthLayout.jsx
│   │   ├── StudentLayout.jsx
│   │   ├── OutletLayout.jsx
│   │   └── AdminLayout.jsx
│   │
│   ├── hooks/
│   │
│   ├── services/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── orders/
│   │   ├── outlets/
│   │   ├── menu/
│   │   └── payments/
│   │
│   ├── context/
│   │
│   ├── utils/
│   │
│   ├── constants/
│   │
│   ├── routes/
│   │
│   ├── styles/
│   │
│   ├── App.jsx
│   └── main.jsx
│
└── package.json


==================================================
1. PAGES
==================================================

ALL full application screens/pages MUST go inside:

src/pages/

Pages represent complete routes/screens.

Examples:

src/pages/auth/Login.jsx
src/pages/auth/Register.jsx

src/pages/student/Home.jsx
src/pages/student/Outlets.jsx
src/pages/student/OutletMenu.jsx
src/pages/student/FoodDetails.jsx
src/pages/student/Cart.jsx
src/pages/student/Checkout.jsx
src/pages/student/OrderConfirmation.jsx
src/pages/student/OrderTracking.jsx
src/pages/student/OrderHistory.jsx
src/pages/student/Profile.jsx

src/pages/outlet/Dashboard.jsx
src/pages/outlet/Orders.jsx
src/pages/outlet/Menu.jsx
src/pages/outlet/Analytics.jsx
src/pages/outlet/Settings.jsx

src/pages/admin/Dashboard.jsx
src/pages/admin/Students.jsx
src/pages/admin/Outlets.jsx
src/pages/admin/Orders.jsx
src/pages/admin/Payments.jsx
src/pages/admin/Reports.jsx

RULE:
If it represents an entire route/page, it belongs in pages/.

Do NOT put complete pages inside components/.


==================================================
2. COMPONENTS
==================================================

ALL reusable UI pieces MUST go inside:

src/components/

Components are smaller reusable pieces used by pages.

Examples:

components/ui/Button.jsx
components/ui/Input.jsx
components/ui/Modal.jsx
components/ui/Badge.jsx
components/ui/Toast.jsx

components/layout/Header.jsx
components/layout/Sidebar.jsx
components/layout/MobileNav.jsx

components/food/FoodCard.jsx
components/food/FoodGrid.jsx
components/food/OutletCard.jsx
components/food/QuantitySelector.jsx

components/cart/CartItem.jsx
components/cart/CartSummary.jsx

components/orders/OrderCard.jsx
components/orders/OrderStatusBadge.jsx
components/orders/OrderTimeline.jsx

components/outlet/OrderQueue.jsx
components/outlet/IncomingOrderCard.jsx
components/outlet/MenuItemTable.jsx

components/admin/UserTable.jsx
components/admin/OutletTable.jsx
components/admin/PaymentTable.jsx

RULE:
If a UI element can reasonably be reused across multiple pages, make it a component.

Do NOT create a separate component for every tiny HTML element unnecessarily.


==================================================
3. UI COMPONENTS
==================================================

Generic reusable UI components belong in:

src/components/ui/

Examples:

Button
Input
Select
Checkbox
Radio
Switch
Modal
Dialog
Badge
Avatar
Tabs
Dropdown
Tooltip
Toast
Spinner
Skeleton
Pagination

These components must remain domain-independent.

For example:

GOOD:
components/ui/Button.jsx

BAD:
components/ui/OrderButton.jsx

An order-specific button belongs in:
components/orders/


==================================================
4. LAYOUT COMPONENTS
==================================================

Reusable navigation/layout elements belong in:

src/components/layout/

Examples:

Header.jsx
Sidebar.jsx
MobileNav.jsx
Breadcrumbs.jsx
PageHeader.jsx

Full page layouts belong in:

src/layouts/

Examples:

StudentLayout.jsx
OutletLayout.jsx
AdminLayout.jsx
AuthLayout.jsx


==================================================
5. SERVICES
==================================================

ALL API communication MUST be separated from UI components.

API/service files belong in:

src/services/

Examples:

services/api/client.js

services/auth/authService.js

services/outlets/outletService.js

services/menu/menuService.js

services/orders/orderService.js

services/payments/paymentService.js

RULE:

Do NOT write fetch/axios API calls directly inside large page components.

BAD:

Home.jsx
→ fetch("/api/outlets")

GOOD:

outletService.js
→ API request

Home.jsx
→ calls outletService


==================================================
6. HOOKS
==================================================

Reusable React hooks belong in:

src/hooks/

Examples:

useAuth.js
useCart.js
useOrders.js
useOutlets.js
useDebounce.js
useNotifications.js

A hook should contain reusable React state/behavior.

Do not put general utility functions inside hooks.


==================================================
7. CONTEXT
==================================================

Global React state belongs in:

src/context/

Examples:

AuthContext.jsx
CartContext.jsx
NotificationContext.jsx

Only use Context for state that genuinely needs to be shared globally.

Do not put every piece of state into Context.


==================================================
8. UTILITIES
==================================================

Pure helper functions belong in:

src/utils/

Examples:

formatCurrency.js
formatDate.js
formatTime.js
validators.js
orderStatus.js

Utilities should generally be independent of React UI.


==================================================
9. CONSTANTS
==================================================

Application-wide constants belong in:

src/constants/

Examples:

routes.js
orderStatuses.js
roles.js
categories.js


==================================================
10. ROUTES
==================================================

Routing configuration belongs in:

src/routes/

Example:

src/routes/AppRoutes.jsx

Route definitions should NOT be scattered throughout page components.

Example:

/login
/student
/student/outlets
/student/orders
/outlet
/outlet/orders
/admin
/admin/users


==================================================
11. ASSETS
==================================================

Static images/icons/fonts belong in:

src/assets/

Use:

assets/images/
assets/icons/
assets/fonts/

Do NOT put images randomly inside components or pages.


==================================================
12. STYLING
==================================================

Global styles belong in:

src/styles/

Examples:

globals.css
variables.css

Component-specific styling should generally use Tailwind CSS or the project's established styling approach.

Do not introduce another styling system without explicit approval.


==================================================
13. NAMING RULES
==================================================

Use PascalCase for React components:

FoodCard.jsx
OrderCard.jsx
Login.jsx

Use camelCase for:

services
hooks
utils
helper files

Examples:

authService.js
useAuth.js
formatCurrency.js

Do not create inconsistent names such as:

food-card.jsx
Food_card.jsx
foodCardComponent.jsx


==================================================
14. BEFORE CREATING A FILE
==================================================

ALWAYS follow this process:

1. Check the existing folder structure.
2. Determine whether the required functionality already exists.
3. Reuse an existing component/service/hook if possible.
4. If a new file is necessary, determine its correct architectural category.
5. Put it in the appropriate folder.
6. Update imports.
7. Do not create duplicate functionality.


==================================================
15. PAGE VS COMPONENT RULE
==================================================

Use this simple rule:

PAGE = complete route/screen

COMPONENT = reusable UI section

LAYOUT = structure shared by multiple pages

SERVICE = API/backend communication

HOOK = reusable React behavior/state

CONTEXT = shared global state

UTILITY = pure helper function

CONSTANT = fixed application value

ROUTE = routing configuration

ASSET = image/icon/font


==================================================
16. DO NOT DO THIS
==================================================

Never create:

src/components/pages/
src/components/screens/
src/pages/components/
src/misc/
src/helpers/
src/random/
src/temp/

unless explicitly requested.

Do not create duplicate folders such as:

components/common/
components/shared/
components/reusable/

when an existing appropriate folder already exists.

Do not move existing files simply to satisfy personal preferences.

Preserve the established architecture.


==================================================
17. FEATURE ORGANIZATION
==================================================

When implementing a new feature, separate responsibilities.

Example: Order Tracking

Page:
pages/student/OrderTracking.jsx

Components:
components/orders/OrderTimeline.jsx
components/orders/OrderStatusBadge.jsx
components/orders/OrderDetails.jsx

Service:
services/orders/orderService.js

Hook:
hooks/useOrders.js

Constants:
constants/orderStatuses.js

This is the expected pattern.


==================================================
18. IMPORTANT RULE FOR EXISTING PROJECTS
==================================================

Before modifying the frontend:

1. Inspect the current folder structure.
2. Understand the existing architecture.
3. Do not replace the architecture unnecessarily.
4. Do not create parallel structures.
5. Reuse existing components.
6. Only create files where they logically belong.
7. Keep imports clean.
8. Keep each file responsible for one clear purpose.

If the requested feature does not fit the current structure, explain where it should go before creating a new architectural pattern.


==================================================
FINAL INSTRUCTION
==================================================

Treat the folder structure as an architectural contract.

Every file must have a clear reason for existing and a clear location.

Pages go to pages.
Components go to components.
Layouts go to layouts.
API calls go to services.
Reusable React behavior goes to hooks.
Global state goes to context.
Utilities go to utils.
Constants go to constants.
Routes go to routes.
Static assets go to assets.

DO NOT violate this structure for convenience.

The goal is a clean, scalable, maintainable React codebase that can grow into the complete Campus Food platform without becoming disorganized.

### The core rule to remember

PAGE       → What the user sees at a URL
COMPONENT  → Reusable UI
LAYOUT     → Shared page structure
SERVICE    → Talks to backend
HOOK       → Reusable React logic
CONTEXT    → Global state
UTILITY    → Helper function
CONSTANT   → Fixed value
ROUTE      → URL configuration
ASSET      → Images/icons/fonts
