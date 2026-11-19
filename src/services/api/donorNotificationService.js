
import { auth } from '../../firebase/config';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function notifyDonorApplicationStatus({
  donorId,
  status,
  reviewEventId,
}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Administrator is not authenticated.');
  }

  if (!donorId || !reviewEventId) {
    throw new Error('Missing donor ID or review event ID.');
  }

  // Obtain a Firebase ID token for backend authentication.
  const idToken = await user.getIdToken();

  const response = await fetch(
    `${API_BASE_URL}/api/donors/notify-status`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        donorId,
        status,
        reviewEventId,
      }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof result.detail === 'string'
        ? result.detail
        : 'Failed to send donor notification.'
    );
  }

  return result;
}
