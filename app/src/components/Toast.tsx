type ToastProps = {
  message: string | null;
  visible: boolean;
};

export function Toast({ message, visible }: ToastProps) {
  return (
    <div className={`toast${visible ? ' show' : ''}`} role="status">
      {message}
    </div>
  );
}
