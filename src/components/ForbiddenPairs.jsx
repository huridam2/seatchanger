import { useState } from 'react'

function ForbiddenPairs({ students, forbiddenPairs, onAddPair, onRemovePair }) {
  const [student1Id, setStudent1Id] = useState('')
  const [student2Id, setStudent2Id] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = () => {
    if (!student1Id || !student2Id) {
      alert('두 학생을 모두 선택해주세요.')
      return
    }

    if (student1Id === student2Id) {
      alert('같은 학생을 선택할 수 없습니다.')
      return
    }

    // 중복 체크
    const exists = forbiddenPairs.some(
      pair =>
        (pair.student1Id === student1Id && pair.student2Id === student2Id) ||
        (pair.student1Id === student2Id && pair.student2Id === student1Id)
    )

    if (exists) {
      alert('이미 설정된 짝 금지입니다.')
      return
    }

    onAddPair(student1Id, student2Id)
    setStudent1Id('')
    setStudent2Id('')
    setIsAdding(false)
  }

  const getStudentName = (id) => {
    const student = students.find(s => s.id === id)
    return student ? `${student.number}. ${student.name}` : ''
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">짝 금지 설정</h2>
        <span className="text-sm text-gray-500">
          {forbiddenPairs.length}개 설정됨
        </span>
      </div>

      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full mb-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          ➕ 짝 금지 추가
        </button>
      ) : (
        <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                첫 번째 학생
              </label>
              <select
                value={student1Id}
                onChange={(e) => setStudent1Id(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">선택하세요</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.number}. {student.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                두 번째 학생
              </label>
              <select
                value={student2Id}
                onChange={(e) => setStudent2Id(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">선택하세요</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.number}. {student.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              추가
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setStudent1Id('')
                setStudent2Id('')
              }}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {forbiddenPairs.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            설정된 짝 금지가 없습니다.
          </div>
        ) : (
          forbiddenPairs.map((pair, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-600 font-bold">🚫</span>
                <span className="text-gray-800">
                  {getStudentName(pair.student1Id)} ↔ {getStudentName(pair.student2Id)}
                </span>
              </div>
              <button
                onClick={() => onRemovePair(index)}
                className="text-red-600 hover:text-red-800"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>

      {forbiddenPairs.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            💡 <strong>참고:</strong> 짝 금지로 설정된 학생들은 인접한 좌석에 배정되지 않습니다.
          </p>
        </div>
      )}
    </div>
  )
}

export default ForbiddenPairs

