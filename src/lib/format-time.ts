export function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInSecs = Math.floor(diffInMs / 1000)
  const diffInMins = Math.floor(diffInSecs / 60)
  const diffInHours = Math.floor(diffInMins / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMins < 1) return '방금 전'
  if (diffInMins < 60) return `${diffInMins}분 전`
  if (diffInHours < 24) return `${diffInHours}시간 전`
  return `${diffInDays}일 전`
}
