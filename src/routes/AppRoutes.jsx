import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import AdminLayout from '../layouts/AdminLayout'

import LoginPage from '../features/auth/LoginPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import VerificationListPage from '../features/verifications/VerificationListPage'
import VerificationDetailPage from '../features/verifications/VerificationDetailPage'
import PendingRequestsPage from '../features/requests/PendingRequestsPage'
import PendingDonorsPage from '../features/donors/PendingDonorsPage'
import UsersPage from '../features/users/UsersPage'

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected PRC Admin Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/verifications" element={<VerificationListPage />} />
          <Route path="/verifications/:id" element={<VerificationDetailPage />} />
          <Route path="/blood-requests" element={<PendingRequestsPage />} />
          <Route path="/donors" element={<PendingDonorsPage />} />
          <Route path="/users" element={<UsersPage />} />
          
          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default AppRoutes