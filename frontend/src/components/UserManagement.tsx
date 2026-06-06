import { useState, useEffect } from "react";
import { ArrowLeft, Search, Plus, Edit, XCircle, Trash2 } from "lucide-react";
import { AddUserModal } from "./AddUserModal";
import { EditUserModal } from "./EditUserModal";
import { DeactivateUserModal } from "./DeactivateUserModal";
import { DeleteUserModal } from "./DeleteUserModal";
import api from "../api";


/**
 * Props for the UserManagement component.
 *
 * Provides callbacks and configuration used by the user management UI.
 *
 * @property onBack - Required callback invoked when the user requests to navigate back or close the user management view.
 *                      Implementations should handle navigation or view cleanup. The callback receives no arguments and does not return a value.
 */
interface UserManagementProps {
  onBack: () => void;
}

/**
 * UserManagement Component
 * 
 * A comprehensive user management interface that allows administrators to view, search, add, edit,
 * deactivate, and delete users with pagination support.
 * 
 * @component
 * @param {UserManagementProps} props - Component props
 * @param {Function} props.onBack - Callback function triggered when the back button is clicked
 * 
 * @returns {React.ReactElement} A user management interface with the following features:
 * - User list display with name, role, status, and ID columns
 * - Search functionality to filter users by name or ID
 * - Pagination with customizable page numbers (up to 7 buttons displayed)
 * - Add user functionality with modal form
 * - Edit user functionality with modal form
 * - Deactivate user functionality with confirmation modal
 * - Delete user functionality with confirmation modal
 * - Loading and error states
 * - Responsive design with Tailwind CSS styling
 * 
 * @state {string} searchTerm - Current search input value
 * @state {number} currentPage - Currently active page number
 * @state {boolean} showAddModal - Controls visibility of add user modal
 * @state {boolean} showEditModal - Controls visibility of edit user modal
 * @state {boolean} showDeactivateModal - Controls visibility of deactivate confirmation modal
 * @state {boolean} showDeleteModal - Controls visibility of delete confirmation modal
 * @state {object|null} selectedUser - Currently selected user for editing, deactivating, or deleting
 * @state {array} users - List of all users fetched from the API
 * @state {boolean} loading - Loading state during API fetch
 * @state {string|null} error - Error message if user fetch fails
 * 
 * @example
 * <UserManagement onBack={() => navigate('/dashboard')} />
 */
export function UserManagement({ onBack }: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.get('/users');
        if (mounted) {
          // resp.data expected to be an array of users (see server)
          setUsers(Array.isArray(resp.data) ? resp.data.map((u: any) => ({
            name: u.fullName,
            role: u.role,
            status: u.status,
            id: u.orgUserId || u.userId,
            email: u.email
          })) : []);
        }
      } catch (err: any) {
        console.error('Failed to fetch users', err);
        if (mounted) {
          setError('Failed to load users');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchUsers();
    return () => { mounted = false; };
  }, []);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pageSize = 5; // adjust as needed
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  const startIndex = (currentPage - 1) * pageSize;
  const displayedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    const maxButtons = 7; // maximum page number buttons to show (including first/last)
    if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);

    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i > 1 && i < totalPages) pages.add(i);
    }

    return Array.from(pages).sort((a, b) => a - b);
  };

  /**
   * Adds a new user by sending a POST request and updating local component state.
   *
   * Constructs a payload from the provided `userData` and posts it to the '/users' endpoint via the `api` client.
   * On a successful response (checked via `resp.data.success`), a normalized user object is created from the response
   * (falling back to the original payload values) and appended to the users state via `setUsers`.
   *
   * Failure modes:
   * - If the server responds with a failure, an alert is shown with the server-provided message or 'Unknown'.
   * - Network or unexpected errors are caught, logged to the console, and a generic error alert is shown.
   *
   * @param userData - New user information. Expected shape:
   *   { fullName: string; email: string; employeeId: string | number; role: string; password: string; department?: string }
   *   The function uses these fields to build the request payload and to populate the local user entry when the request succeeds.
   * @returns Promise<void> - Resolves when the add operation completes (no value returned).
   */
  const handleAddUser = async (userData: any) => {
    try {
      const payload = {
        fullName: userData.fullName,
        email: userData.email,
        employeeId: userData.employeeId,
        role: userData.role,
        password: userData.password
      };
      const resp = await api.post('/users', payload);
      if (resp.data && resp.data.success) {
        const created = resp.data.user;
        const newUser = {
          name: created.FullName || payload.fullName,
          role: created.UserRole || payload.role,
          status: created.Status || 'Active',
          id: created.OrgUserId || payload.employeeId,
          email: created.UserEmail || payload.email,
          department: userData.department
        };
        setUsers(prev => [...prev, newUser]);
      } else {
        alert('Failed to add user: ' + (resp.data && resp.data.message ? resp.data.message : 'Unknown'));
      }
    } catch (err) {
      console.error('Add user error', err);
      alert('Error adding user');
    }
  };

  /**
   * Handle editing a user by sending an update request to the API and updating local state.
   *
   * Sends a PUT request to '/users' with a payload containing the user's id, fullName, status,
   * and optionally promoteToFaculty and password when present on the provided userData.
   *
   * On a successful response (resp.data.success === true) the local users state is updated via
   * setUsers: the user with the matching id is replaced/merged with values returned by the server
   * (resp.data.user.FullName, resp.data.user.UserRole, resp.data.user.Status). If a server field
   * is missing the function falls back to the original userData or existing user fields.
   *
   * On failure the function shows an alert ("Failed to save user") and on unexpected exceptions
   * it logs the error to the console and shows an alert ("Error saving user").
   *
   * @param userData - Object containing the user data to save. Expected properties:
   *   - id: string | number — unique identifier of the user (required)
   *   - fullName: string — user's full name (required)
   *   - status: string — user's status (required)
   *   - promoteToFaculty?: boolean — when true, includes promoteToFaculty: true in the payload
   *   - password?: string — when present, includes password in the payload
   *
   * @returns A Promise that resolves to void. The function never throws to callers because
   * errors are handled internally (alerts and console.error); any needed propagation should be
   * implemented by the caller if different behavior is desired.
   *
   * @remarks
   * - The function depends on an `api` instance for HTTP requests and a `setUsers` state setter
   *   (closure captured from the component) to update client-side state.
   * - Expected server response shape:
   *   { data: { success: boolean, user?: { FullName?: string, UserRole?: string, Status?: string } } }
   *
   * @example
   * await handleEditUser({
   *   id: '123',
   *   fullName: 'Jane Doe',
   *   status: 'active',
   *   promoteToFaculty: true,
   *   password: 'new-password'
   * });
   */
  const handleEditUser = async (userData: any) => {
    try {
      const payload: any = {
        id: userData.id,
        fullName: userData.fullName,
        status: userData.status,
      };
      if (userData.promoteToFaculty) payload.promoteToFaculty = true;
      if (userData.password) payload.password = userData.password;
      const resp = await api.put('/users', payload);
      if (resp.data && resp.data.success) {
        const updated = resp.data.user;
        setUsers(prev => prev.map(u =>
          u.id === userData.id ? {
            ...u,
            name: updated.FullName || userData.fullName,
            role: updated.UserRole || u.role,
            status: updated.Status || userData.status
          } : u
        ));
      } else {
        alert('Failed to save user');
      }
    } catch (err) {
      console.error('Edit user error', err);
      alert('Error saving user');
    }
  };

  /**
   * Attempts to deactivate the currently selected user.
   *
   * If `selectedUser` is falsy, the function returns immediately (no-op).
   * Otherwise it sends a POST request to '/users/deactivate' with payload `{ id: selectedUser.id }`.
   * On a successful response (`resp.data && resp.data.success === true`) it updates the local `users`
   * state by setting the matching user's `status` to `'Inactive'`. If the response indicates failure,
   * an alert "Failed to deactivate user" is shown. Network or unexpected errors are caught, logged to the
   * console with the prefix "Deactivate error", and a user-facing alert "Error deactivating user" is shown.
   *
   * The function is asynchronous and returns a Promise that resolves to void.
   *
   * Note: This function closes over external identifiers: `selectedUser`, `api`, and `setUsers`.
   * It assumes user objects have an `id` field and a `status` field that can be set to `'Inactive'`.
   *
   * @async
   * @returns {Promise<void>} A promise that resolves when the deactivation attempt completes.
   */
  const handleDeactivateUser = async () => {
    if (!selectedUser) return;
    try {
      const resp = await api.post('/users/deactivate', { id: selectedUser.id });
      if (resp.data && resp.data.success) {
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: 'Inactive' } : u));
      } else {
        alert('Failed to deactivate user');
      }
    } catch (err) {
      console.error('Deactivate error', err);
      alert('Error deactivating user');
    }
  };

  const handleEditClick = (user: any) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDeactivateClick = (user: any) => {
    setSelectedUser(user);
    setShowDeactivateModal(true);
  };

  const handleDeleteClick = (user: any) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  /**
   * Attempts to delete the currently selected user on the server and update the UI state.
   *
   * Behavior:
   * - If no user is selected, the function returns immediately.
   * - Sends a POST request to '/users/delete' with payload `{ id: selectedUser.id }`.
   * - Expects a response shape similar to `{ success: boolean, message?: string }`.
   * - On success (`resp.data.success === true`): removes the deleted user from local `users` state
   *   and clears the `selectedUser` selection.
   * - If the server responds with success === false: shows an alert with the returned message (or 'Unknown').
   * - On network or unexpected errors: logs the error to the console and shows a generic alert.
   *
   * Notes:
   * - The function is asynchronous and returns a `Promise<void>`.
   * - Side effects include calling `api.post`, updating `users` via `setUsers`, and calling `setSelectedUser(null)`.
   *
   * @returns Promise<void> A promise that resolves when the delete flow completes (success or handled failure).
   */
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      const resp = await api.post('/users/delete', { id: selectedUser.id });
      if (resp.data && resp.data.success) {
        // remove from UI and clear selection
        setUsers(prev => prev.filter(user => user.id !== selectedUser.id));
        setSelectedUser(null);
      } else {
        alert('Failed to delete user: ' + (resp.data?.message || 'Unknown'));
      }
    } catch (err) {
      console.error('Delete user error', err);
      alert('Error deleting user');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-slate-800">User Management</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add User
            </button>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by Name/ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-80 px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              </div>
              <button className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors">
                Go
              </button>
            </div>
          </div>

          {/* Table */}
          {loading && <div className="p-4 text-center text-slate-600">Loading users…</div>}
          {error && <div className="p-4 text-center text-red-600">{error}</div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-slate-700">Name</th>
                  <th className="text-left py-3 px-4 text-slate-700">Role</th>
                  <th className="text-left py-3 px-4 text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 text-slate-700">ID</th>
                  <th className="text-left py-3 px-4 text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((user, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-700">{user.name}</td>
                    <td className="py-3 px-4 text-slate-700">{user.role}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{user.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditClick(user)}
                          className="flex items-center gap-1 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeactivateClick(user)}
                          className="flex items-center gap-1 px-3 py-1 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Deactivate
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(user)}
                          className="flex items-center gap-1 px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 border rounded transition-colors ${
                currentPage === 1 ? "opacity-50 cursor-not-allowed" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              &lt;
            </button>

            {(() => {
              const pages = getPageNumbers();
              const items: React.ReactNode[] = [];
              let last = 0;
              for (const p of pages) {
                if (last && p - last > 1) {
                  items.push(
                    <span key={`dots-${last}`} className="px-2 text-slate-500 select-none">…</span>
                  );
                }
                items.push(
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`px-3 py-1 border rounded transition-colors ${
                      currentPage === p ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                );
                last = p;
              }
              return items;
            })()}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 border rounded transition-colors ${
                currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddUser}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => setShowEditModal(false)}
          onSave={handleEditUser}
        />
      )}

      {showDeactivateModal && selectedUser && (
        <DeactivateUserModal
          userName={selectedUser.name}
          onClose={() => setShowDeactivateModal(false)}
          onConfirm={handleDeactivateUser}
        />
      )}

      {showDeleteModal && selectedUser && (
        <DeleteUserModal
          userName={selectedUser.name}
          userId={selectedUser.id}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteUser}
        />
      )}
    </div>
  );
}