import React from "react";
import { LuLoader } from "react-icons/lu";

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3">
      <LuLoader className="animate-spin text-[#D32F2F]" size={36} />
      <p className="text-sm font-medium text-gray-500">{message}</p>
    </div>
  );
};

export default LoadingSpinner;