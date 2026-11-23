import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from './ProtectedRoute';
import AdminLayout from '../layouts/AdminLayout';

// Authentication
import LoginPage from '../features/auth/LoginPage';

// Dashboard
import DashboardPage from '../features/dashboard/DashboardPage';

// Blood Requests
import ParentBloodRequestsManager from '../features/requests/ParentBloodRequestsManager';
import ArchivedRequests from '../pages/ArchivedRequests';

// Donor Management
import PendingDonorsPage from '../features/donors/PendingDonorsPage';
import DonorAppointmentsPage from '../features/donors/DonorAppointmentsPage';
import DonorScreeningPage from '../features/donors/DonorScreeningPage';
import ActiveDonorsPage from '../features/donors/ActiveDonorsPage';
import ArchivedDonors from '../pages/ArchivedDonors';

// Users
import UsersPage from '../features/users/UsersPage';

// Chat
import AdminChatListPage from '../features/chat/AdminChatListPage';
import AdminChatRoomPage from '../features/chat/AdminChatRoomPage';

// Announcements (under development; the original pages are commented out)
import AnnouncementsUnderDevelopment from '../features/announcements/AnnouncementsUnderDevelopment';
// import CreateAnnouncementPage from '../features/announcements/CreateAnnouncementPage';
// import PublishedAnnouncementsPage from '../features/announcements/PublishedAnnouncementsPage';
// import ArchivedAnnouncements from '../pages/ArchivedAnnouncements';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          {/* Dashboard */}
          <Route
            path="/"
            element={<DashboardPage />}
          />

          {/* Blood Requests */}
          <Route
            path="/blood-requests"
            element={<ParentBloodRequestsManager />}
          />

          <Route
            path="/blood-requests/archive"
            element={<ArchivedRequests />}
          />

          {/* Donor Management */}
          <Route
            path="/donors"
            element={<PendingDonorsPage />}
          />

          <Route
            path="/donors/appointments"
            element={<DonorAppointmentsPage />}
          />

          <Route
            path="/donors/screening"
            element={<DonorScreeningPage />}
          />

          <Route
            path="/donors/active"
            element={<ActiveDonorsPage />}
          />

          <Route
            path="/donors/archive"
            element={<ArchivedDonors />}
          />

          {/* Users */}
          <Route
            path="/users"
            element={<UsersPage />}
          />

          {/* Chat */}
          <Route
            path="/chats"
            element={<AdminChatListPage />}
          />

          <Route
            path="/chat/:chatId"
            element={<AdminChatRoomPage />}
          />

          <Route
            path="/announcements/*"
            element={<AnnouncementsUnderDevelopment />}
          />

          {/* Announcements
          <Route
            path="/announcements"
            element={<CreateAnnouncementPage />}
          />

          <Route
            path="/announcements/published"
            element={<PublishedAnnouncementsPage />}
          />

          <Route
            path="/announcements/archive"
            element={<ArchivedAnnouncements />}
          /> */}

          {/* Unknown routes */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;