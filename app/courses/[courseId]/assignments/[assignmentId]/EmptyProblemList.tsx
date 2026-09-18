import { FileQuestion } from "lucide-react";

const EmptyProblemList = () => (
  <div className="text-center py-8">
    <div className="text-gray-400 mb-3">
      <FileQuestion className="w-12 h-12 mx-auto" />
    </div>
    <p className="text-gray-500 text-sm">No problems in this assignment yet</p>
  </div>
);

export default EmptyProblemList;
