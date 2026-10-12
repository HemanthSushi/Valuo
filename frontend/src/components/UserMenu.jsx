import { User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UserMenu() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user"));

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="relative group cursor-pointer">
      <User className="w-6 h-6" />

      <div className="absolute right-0 mt-2 w-40 bg-white border shadow-md hidden group-hover:block">
        <div className="p-2 text-sm border-b">{user?.email}</div>
        <button
          onClick={logout}
          className="flex items-center gap-2 p-2 w-full text-sm hover:bg-gray-100"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
