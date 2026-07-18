export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">KansRide</h1>
          <p className="text-gray-500 mt-2">Admin Dashboard</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" placeholder="admin@kansride.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" placeholder="••••••••" />
          </div>
          <button className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition">Sign In</button>
        </div>
      </div>
    </div>
  );
}
