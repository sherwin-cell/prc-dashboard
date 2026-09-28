import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AdminLayout from '../layouts/AdminLayout';

import LoginPage from '../features/auth/LoginPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import ParentBloodRequestsManager from '../features/requests/ParentBloodRequestsManager';
import ArchivedRequests from '../pages/ArchivedRequests';
import PendingDonorsPage from '../features/donors/PendingDonorsPage';
import ArchivedDonors from '../pages/ArchivedDonors';
import UsersPage from '../features/users/UsersPage';

// Chat Pages
import AdminChatListPage from '../features/chat/AdminChatListPage';
import AdminChatRoomPage from '../features/chat/AdminChatRoomPage';

// Announcement Pages (Separated Architecture)
import CreateAnnouncementPage from '../features/announcements/CreateAnnouncementPage';
import PublishedAnnouncementsPage from '../features/announcements/PublishedAnnouncementsPage';
import ArchivedAnnouncements from '../pages/ArchivedAnnouncements';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected PRC Admin Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          
          {/* Blood Requests and Archive Subroutes */}
          <Route path="/blood-requests" element={<ParentBloodRequestsManager />} />
          <Route path="/blood-requests/archive" element={<ArchivedRequests />} />

          {/* Donors and Archive Subroutes */}
          <Route path="/donors" element={<PendingDonorsPage />} />
          <Route path="/donors/archive" element={<ArchivedDonors />} />

          <Route path="/users" element={<UsersPage />} />

          {/* Chat Routes */}
          <Route path="/chats" element={<AdminChatListPage />} />
          <Route path="/chat/:chatId" element={<AdminChatRoomPage />} />

          {/* Announcements Subroutes (Create, Published List, Archive) */}
          <Route path="/announcements" element={<CreateAnnouncementPage />} />
          <Route path="/announcements/published" element={<PublishedAnnouncementsPage />} />
          <Route path="/announcements/archive" element={<ArchivedAnnouncements />} />
          
          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AppRoutes;