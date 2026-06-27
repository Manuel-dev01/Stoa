/**
 * The Stoa mark — three verdigris nodes (the Triad) converging along structural
 * lines into a single gold node: the synthesis the machine pays for. The toll
 * is always the gold point; the reasoning is always the green.
 */
export function TriadMark({
  size = 24,
  className,
  withLines = true,
}: {
  size?: number
  className?: string
  withLines?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {withLines && (
        <path
          d="M8 22 L16 24.5 M24 22 L16 24.5 M16 6 L16 24.5"
          stroke="#3A352B"
          strokeWidth="1.1"
        />
      )}
      <circle cx="8" cy="22" r="2.6" fill="#5FA391" />
      <circle cx="24" cy="22" r="2.6" fill="#5FA391" />
      <circle cx="16" cy="6" r="2.6" fill="#5FA391" />
      <circle cx="16" cy="24.5" r="3.2" fill="#C8A45D" />
    </svg>
  )
}
