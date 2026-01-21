import { useState } from 'react'

function StudentList({ students, onAdd, onUpdate, onDelete }) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ number: '', name: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    if (editingId) {
      onUpdate(editingId, formData.number, formData.name)
      setEditingId(null)
    } else {
      onAdd(formData.number || (students.length + 1), formData.name)
    }

    setFormData({ number: '', name: '' })
    setIsAdding(false)
  }

  const handleEdit = (student) => {
    setEditingId(student.id)
    setFormData({ number: student.number, name: student.name })
    setIsAdding(true)
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ number: '', name: '' })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">학생 명단</h2>
        <span className="text-sm text-gray-500">총 {students.length}명</span>
      </div>

      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full mb-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          ➕ 학생 추가
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              번호
            </label>
            <input
              type="text"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              placeholder="자동"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="학생 이름"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
            >
              {editingId ? '수정' : '추가'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {students.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            학생 명단이 비어있습니다.
            <br />
            CSV 파일을 업로드하거나 직접 추가해주세요.
          </div>
        ) : (
          students.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-600 w-8">
                  {student.number}
                </span>
                <span className="text-gray-800 font-medium">{student.name}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(student)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    if (confirm(`${student.name} 학생을 삭제하시겠습니까?`)) {
                      onDelete(student.id)
                    }
                  }}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default StudentList

