export default function TrackRidePage({ params }: { params: { rideId: string } }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-bold text-primary">KansRide Tracking</h1>
      </header>
      <main className="flex-1 flex flex-col">
        <div className="flex-1 bg-gray-200 flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-4">🗺️</p>
            <p className="text-gray-500">Live map for ride</p>
            <p className="text-sm font-mono text-gray-400 mt-2">{params.rideId}</p>
          </div>
        </div>
        <div className="bg-white p-6 border-t">
          <div className="max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-500">Status</span>
              <span className="text-sm font-semibold text-primary">In Progress</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-green-500">●</span>
                <span className="text-sm text-gray-700">Pickup location</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-red-500">●</span>
                <span className="text-sm text-gray-700">Dropoff location</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-6 text-center">Shared by a KansRide passenger for safety</p>
          </div>
        </div>
      </main>
    </div>
  );
}
