import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';

export function EventPayoutApproval() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirection automatique vers la nouvelle page de validation individuelle
    navigate(`/events/${id}/pool-validation`, { replace: true });
  }, [id, navigate]);

  return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]">
      <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#FF7A00] animate-spin" />
    </div>
  );
}
