
const StatusBadge = ({ status }) => {
  const normalizedStatus = status?.toUpperCase() || "PENDING";

  const statusStyles = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const style =
    statusStyles[normalizedStatus] || "bg-gray-50 text-gray-700 border-gray-200";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          normalizedStatus === "APPROVED"
            ? "bg-emerald-500"
            : normalizedStatus === "REJECTED"
            ? "bg-rose-500"
            : "bg-amber-500"
        }`}
      />
      {normalizedStatus}
    </span>
  );
};

export default StatusBadge;