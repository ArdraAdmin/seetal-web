export default function NoAccessPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <h1 className="text-xl font-semibold text-ink">No modules enabled</h1>
      <p className="mt-2 text-sm text-slate-600">
        This account does not have any modules turned on. Ask an administrator
        to update your access.
      </p>
    </div>
  );
}
