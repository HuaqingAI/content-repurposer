export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: 'url(/login-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl px-2 py-2"
        style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
