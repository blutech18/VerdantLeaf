export function formatDbError(error) {
  if (!error) return 'Unknown database error';

  const parts = [
    error.code,
    error.errno ? `errno ${error.errno}` : '',
    error.sqlState ? `sqlState ${error.sqlState}` : '',
    error.message,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' - ') : JSON.stringify(error);
}
