export function handleActionError(error: unknown): string {
  console.error('Action Error:', error);

  if (process.env.NODE_ENV === 'development') {
    if (error instanceof Error) return error.message;
    return 'An unknown error occurred.';
  }

  return 'אירעה שגיאה. נסה שוב מאוחר יותר.';
}
