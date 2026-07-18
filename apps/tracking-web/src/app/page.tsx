export default function TrackingHome() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">KansRide</h1>
        <p className="text-gray-500 mt-4">Track a ride using the link shared with you</p>
        <p className="text-sm text-gray-400 mt-2">Format: /track/[ride-id]?token=[share-token]</p>
      </div>
    </div>
  );
}
