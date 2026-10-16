import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl font-mono font-extrabold text-blue-400">404</div>
        <h1 className="text-xl font-bold">Page Not Found</h1>
        <p className="text-xs text-slate-400">
          The requested dashboard view or indicator could not be located.
        </p>
        <div>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all"
          >
            Return to RBM Partnership Impact Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
