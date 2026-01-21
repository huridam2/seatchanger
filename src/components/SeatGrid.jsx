import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'

function SeatGrid({ layout, seatLayout, assignment, onSeatUpdate, onSeatLock, pairsPerRow = 3, colsPerRow = 6, lockedSeats = new Set() }) {
  const [draggedSeat, setDraggedSeat] = useState(null)

  const handleDragStart = (row, col) => {
    setDraggedSeat({ row, col })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (toRow, toCol) => {
    if (draggedSeat) {
      onSeatUpdate(draggedSeat.row, draggedSeat.col, toRow, toCol)
      setDraggedSeat(null)
    }
  }

  const getSeatStyle = (row, col) => {
    // ㄷ자 형태 특별 처리
    if (seatLayout === 'ㄷ자') {
      // 실제 배정된 좌석의 최대 행 찾기
      const maxRow = assignment.length > 0 ? Math.max(...assignment.map(s => s.row), 0) : 0
      
      if (row === 0 || row === maxRow) {
        // 첫 번째와 마지막 행은 전체 열 사용
        return {}
      } else {
        // 중간 행은 양쪽 끝만 사용
        if (col === 0 || col === colsPerRow - 1) {
          return {}
        } else {
          return { visibility: 'hidden' }
        }
      }
    }
    return {}
  }

  const isPairLayout = seatLayout === 'pair'

  // pair 
  const getPairGroups = () => {
    if (!isPairLayout || assignment.length === 0) return []

    const groups = []
    const processed = new Set()

    assignment.forEach(seat => {
      if (processed.has(`${seat.row}-${seat.col}`)) return

      const pairIndex = seat.pairIndex !== undefined ? seat.pairIndex : Math.floor(seat.col / 2)
      const key = `${seat.row}-${pairIndex}`
      
      if (!groups.find(g => g.key === key)) {
        const student1 = seat.student
        const student2 = assignment.find(
          s => s.row === seat.row && 
               s.pairIndex === pairIndex && 
               s.col !== seat.col
        )?.student

        groups.push({
          key,
          row: seat.row,
          pairIndex,
          student1,
          student2,
          col1: seat.col,
          col2: seat.col + 1,
        })

        processed.add(`${seat.row}-${seat.col}`)
        if (student2) {
          processed.add(`${seat.row}-${seat.col + 1}`)
        }
      }
    })

    // 행과 pairIndex로 정렬
    return groups.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row
      return a.pairIndex - b.pairIndex
    })
  }

  const pairGroups = getPairGroups()

  // 행별로 그룹화
  const rowsMap = new Map()
  pairGroups.forEach(group => {
    if (!rowsMap.has(group.row)) {
      rowsMap.set(group.row, [])
    }
    rowsMap.get(group.row).push(group)
  })

  const maxRow = pairGroups.length > 0 ? Math.max(...pairGroups.map(g => g.row)) : -1

  // 좌석 영역 렌더링 (교사 시점: scaleY(-1) 적용)
  let seatArea = null

  if (isPairLayout) {
    if (maxRow < 0) {
      seatArea = (
        <div className="text-center text-gray-500 py-8" style={{ transform: 'scaleY(-1)' }}>
          좌석 배정을 시작하려면 "자리 배정하기" 버튼을 클릭하세요.
        </div>
      )
    } else {
      const rows = Array.from({ length: maxRow + 1 }).map((_, rowIndex) => {
        const rowGroups = rowsMap.get(rowIndex) || []
        return (
          <div
            key={rowIndex}
            className="grid mb-2 w-full gap-6"
            style={{ gridTemplateColumns: `repeat(${pairsPerRow}, minmax(0, 1fr))`, transform: 'scaleY(-1)' }}
          >
            {Array.from({ length: pairsPerRow }).map((_, pairIdx) => {
              const group = rowGroups.find(g => g.pairIndex === pairIdx)
              if (!group) {
                return (
                  <div key={pairIdx} className="flex gap-0.5 w-full min-w-0" style={{ transform: 'scaleY(-1)' }}>
                    <div className="flex-1 aspect-[5/4] border-2 border-dashed border-gray-300 rounded bg-transparent flex items-center justify-center p-1 min-w-0">
                      <span className="text-xs text-gray-400">빈 자리</span>
                    </div>
                    <div className="flex-1 aspect-[5/4] border-2 border-dashed border-gray-300 rounded bg-transparent flex items-center justify-center p-1 min-w-0">
                      <span className="text-xs text-gray-400">빈 자리</span>
                    </div>
                  </div>
                )
              }

              return (
                <div key={pairIdx} className="flex gap-0.5 flex-1 min-w-0" style={{ transform: 'scaleY(-1)' }}>
                  <div
                    draggable={!!group.student1 && !lockedSeats.has(`${group.row}-${group.col1}`)}
                    onDragStart={() => group.student1 && !lockedSeats.has(`${group.row}-${group.col1}`) && handleDragStart(group.row, group.col1)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(group.row, group.col1)}
                    className={`
                      flex-1 aspect-[5/4] border-2 rounded p-1 min-w-0 relative
                      transition-all duration-200
                      ${group.student1
                        ? 'bg-indigo-100 border-indigo-400 hover:bg-indigo-200 hover:shadow-md' + (lockedSeats.has(`${group.row}-${group.col1}`) ? '' : ' cursor-move')
                        : 'border-dashed border-gray-300 bg-transparent'
                      }
                      ${lockedSeats.has(`${group.row}-${group.col1}`) ? 'ring-2 ring-red-400' : ''}
                    `}
                    style={{ transform: 'scaleY(-1)' }}
                  >
                    {group.student1 && group.student1.number && (
                      <div className="absolute top-0.5 left-2 text-[10px] font-medium text-gray-600 z-10">
                        {group.student1.number}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSeatLock(group.row, group.col1)
                      }}
                      className={`absolute top-0.5 right-0.5 p-0.5 rounded transition-all z-10 ${
                        lockedSeats.has(`${group.row}-${group.col1}`)
                          ? 'hover:bg-red-50'
                          : 'opacity-90 hover:opacity-100 hover:bg-gray-100'
                      }`}
                      title={lockedSeats.has(`${group.row}-${group.col1}`) ? "자리 잠금 해제" : "자리 고정"}
                    >
                      {lockedSeats.has(`${group.row}-${group.col1}`) ? (
                        <Lock className="w-3 h-3 text-red-500 opacity-100" />
                      ) : (
                        <Unlock className="w-3 h-3 text-gray-300" />
                      )}
                    </button>

                    {group.student1 && group.student1.name ? (
                      <div className="flex justify-center items-center w-full h-full pb-0 px-1 pt-1">
                        <div className="text-sm font-bold text-gray-800 text-center whitespace-nowrap overflow-visible">
                          {group.student1.name}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center w-full h-full">
                        <div className="text-xs text-gray-400">빈 자리</div>
                      </div>
                    )}
                  </div>

                  <div
                    draggable={!!group.student2 && !lockedSeats.has(`${group.row}-${group.col2}`)}
                    onDragStart={() => group.student2 && !lockedSeats.has(`${group.row}-${group.col2}`) && handleDragStart(group.row, group.col2)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(group.row, group.col2)}
                    className={`
                      flex-1 aspect-[5/4] border-2 rounded p-1 min-w-0 relative
                      transition-all duration-200
                      ${group.student2
                        ? 'bg-indigo-100 border-indigo-400 hover:bg-indigo-200 hover:shadow-md' + (lockedSeats.has(`${group.row}-${group.col2}`) ? '' : ' cursor-move')
                        : 'border-dashed border-gray-300 bg-transparent'
                      }
                      ${lockedSeats.has(`${group.row}-${group.col2}`) ? 'ring-2 ring-red-400' : ''}
                    `}
                    style={{ transform: 'scaleY(-1)' }}
                  >
                    {group.student2 && group.student2.number && (
                      <div className="absolute top-0.5 left-2 text-[10px] font-medium text-gray-600 z-10">
                        {group.student2.number}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSeatLock(group.row, group.col2)
                      }}
                      className={`absolute top-0.5 right-0.5 p-0.5 rounded transition-all z-10 ${
                        lockedSeats.has(`${group.row}-${group.col2}`)
                          ? 'hover:bg-red-50'
                          : 'opacity-90 hover:opacity-100 hover:bg-gray-100'
                      }`}
                      title={lockedSeats.has(`${group.row}-${group.col2}`) ? "자리 잠금 해제" : "자리 고정"}
                    >
                      {lockedSeats.has(`${group.row}-${group.col2}`) ? (
                        <Lock className="w-3 h-3 text-red-500 opacity-100" />
                      ) : (
                        <Unlock className="w-3 h-3 text-gray-300" />
                      )}
                    </button>

                    {group.student2 && group.student2.name ? (
                      <div className="flex justify-center items-center w-full h-full pb-0 px-1 pt-1">
                        <div className="text-sm font-bold text-gray-800 text-center whitespace-nowrap overflow-visible">
                          {group.student2.name}
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center w-full h-full">
                        <div className="text-xs text-gray-400">빈 자리</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })

      seatArea = (
        <div style={{ transform: 'scaleY(-1)' }}>
          <div className="grid mb-2 w-full gap-6" style={{ gridTemplateColumns: `repeat(${pairsPerRow}, minmax(0, 1fr))` }}>
            {/* 위에서 rows가 만든 각 row div 자체에 grid가 있으므로 rows를 그대로 렌더 */}
          </div>
          {rows}
        </div>
      )
    }
  } else {
    if (assignment.length === 0) {
      seatArea = (
        <div className="text-center text-gray-500 py-8" style={{ transform: 'scaleY(-1)' }}>
          좌석 배정을 시작하려면 "자리 배정하기" 버튼을 클릭하세요.
        </div>
      )
    } else {
      const maxRowGeneral = Math.max(...assignment.map(s => s.row), 0)
      const totalSeats = (maxRowGeneral + 1) * colsPerRow
      seatArea = (
        <div className="grid gap-2 w-full" style={{ gridTemplateColumns: `repeat(${colsPerRow}, minmax(0, 1fr))`, transform: 'scaleY(-1)' }}>
          {Array.from({ length: totalSeats }).map((_, index) => {
            const row = Math.floor(index / colsPerRow)
            const col = index % colsPerRow
            const seat = assignment.find(s => s.row === row && s.col === col)
            const student = seat?.student
            const key = `${row}-${col}`
            const isLocked = lockedSeats.has(key)
            const seatStyle = getSeatStyle(row, col)

            return (
              <div
                key={key}
                style={{ ...seatStyle, transform: 'scaleY(-1)' }}
                draggable={!!student && !isLocked}
                onDragStart={() => student && !isLocked && handleDragStart(row, col)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(row, col)}
                className={`
                      aspect-[5/4] border-2 rounded-lg p-1 w-full min-w-0 relative
                      transition-all duration-200
                      ${student 
                        ? 'bg-indigo-100 border-indigo-400 hover:bg-indigo-200 hover:shadow-md' + (isLocked ? '' : ' cursor-move')
                        : 'border-dashed border-gray-300 bg-transparent'
                      }
                      ${isLocked ? 'ring-2 ring-red-400' : ''}
                    `}
              >
                {student && student.number && (
                  <div className="absolute top-0.5 left-2 text-[10px] font-medium text-gray-600 z-10">
                    {student.number}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onSeatLock(row, col)
                  }}
                  className={`absolute top-0.5 right-0.5 p-0.5 rounded transition-all z-10 ${
                    isLocked
                      ? 'hover:bg-red-50'
                      : 'opacity-90 hover:opacity-100 hover:bg-gray-100'
                  }`}
                  title={isLocked ? "자리 잠금 해제" : "자리 고정"}
                >
                  {isLocked ? (
                    <Lock className="w-3 h-3 text-red-500 opacity-100" />
                  ) : (
                    <Unlock className="w-3 h-3 text-gray-300" />
                  )}
                </button>

                {student && student.name ? (
                  <div className="flex justify-center items-center w-full h-full pb-0 px-1 pt-1">
                    <div className="text-sm font-bold text-gray-800 text-center whitespace-nowrap overflow-visible">
                      {student.name}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center items-center w-full h-full">
                    <div className="text-xs text-gray-400">빈 자리</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
  }

  return (
    <div id="seat-grid-wrapper" className="bg-white rounded-lg shadow-lg p-6">
      <div
        id="seat-grid-content"
        className="w-full flex flex-col gap-4"
        style={{ display: 'inline-block', width: 'fit-content', minWidth: '100%' }}
      >
        <h2 className="text-2xl font-bold text-gray-800 text-center">
          교실 배치도
        </h2>

        {/* 상단: 좌석 그리드 + 창가/복도 */}
        <div className="flex items-stretch gap-4 w-full">
          {/* 복도 (왼쪽) - 항상 표시 */}
          <div className="bg-gradient-to-b from-gray-200 to-gray-300 w-12 flex flex-col justify-center items-center rounded-lg shadow-sm flex-shrink-0 min-h-full">
            <div className="writing-vertical-rl text-gray-700 font-bold text-sm py-4">
              🚪 복 도
            </div>
          </div>

          {/* 좌석 배치 영역 */}
          <div className="flex-1 w-full">
            {seatArea}
          </div>

          {/* 창가 (오른쪽) - 항상 표시 */}
          <div className="bg-gradient-to-b from-blue-100 to-blue-200 w-12 flex flex-col justify-center items-center rounded-lg shadow-sm flex-shrink-0 min-h-full">
            <div className="writing-vertical-rl text-blue-800 font-bold text-sm py-4">
              🪟 창 가
            </div>
          </div>
        </div>

        {/* 하단: 교탁 (캡처 포함) */}
        <div className="flex justify-center">
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white px-12 py-4 rounded-lg shadow-md font-bold text-lg">
            🖥️ 교탁
          </div>
        </div>
      </div>
    </div>
  )
}

export default SeatGrid
