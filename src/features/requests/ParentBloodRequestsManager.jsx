import { useState } from "react";
import BloodRequestsPage from "./BloodRequestsPage";
import BloodRequestDetail from "./BloodRequestDetail";

const ParentBloodRequestsManager = () => {
  const [selectedRequest, setSelectedRequest] = useState(null);

  return (
    <div>
      {selectedRequest ? (
        <BloodRequestDetail 
          request={selectedRequest} 
          onBack={() => setSelectedRequest(null)} 
          onUpdateStatus={(updated) => setSelectedRequest(updated)}
        />
      ) : (
        <BloodRequestsPage onViewDetail={(req) => setSelectedRequest(req)} />
      )}
    </div>
  );
};

export default ParentBloodRequestsManager;