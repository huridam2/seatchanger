import { useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import SeatGrid from './components/SeatGrid'
import StudentList from './components/StudentList'

const SEAT_LAYOUTS = {
  '5x5': { rows: 5, cols: 5 },
  '5x6': { rows: 5, cols: 6 },
  'pair': { rows: 4, cols: 6 }, // 2명씩 짝지어 앉기
  'ㄷ자': { rows: 6, cols: 5 }, // ㄷ자 형태
}

function App() {
  const [students, setStudents] = useState([])
  const [seatLayout, setSeatLayout] = useState('5x5')
  const [seatAssignment, setSeatAssignment] = useState([])
  const [forbiddenPairs, setForbiddenPairs] = useState([])
  const [pairsPerRow, setPairsPerRow] = useState(3) // 한 줄에 배치할 분단(짝) 개수
  const [colsPerRow, setColsPerRow] = useState(6) // 한 줄에 배치할 열(학생) 개수 (일반 모드)
  const [lockedSeats, setLockedSeats] = useState(new Set()) // 잠긴 자리 인덱스 (Set으로 관리)
  const [isDownloading, setIsDownloading] = useState(false) // 이미지 다운로드 로딩 상태
  const seatGridRef = useRef(null) // 좌석 배치도 참조용

  // CSV 파일 업로드
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // 기존 데이터 초기화
    setStudents([])
    setForbiddenPairs([])
    setSeatAssignment([])

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedStudents = []
        const parsedForbiddenPairs = []
        let studentIndex = 0

        // CSV의 컬럼명 확인 (다양한 형태 지원)
        const numberColumn = results.meta.fields?.find(
          field => field === '번호' || field === 'number' || field === 'Number' || field === '번호'
        ) || '번호'
        
        const nameColumn = results.meta.fields?.find(
          field => field === '이름' || field === 'name' || field === 'Name'
        ) || '이름'

        // 컬럼 순서 확인 (첫 번째, 두 번째, 세 번째 컬럼)
        const columns = results.meta.fields || []
        const firstColumn = columns[0] || ''
        const secondColumn = columns[1] || ''
        const thirdColumn = columns[2] || ''

        results.data.forEach((row) => {
          // 첫 번째 컬럼(번호)의 값 가져오기
          const firstColumnValue = String(row[firstColumn] || '').trim()
          
          // 그룹 A: 첫 번째 컬럼에 값이 있는 행만 학생으로 처리
          if (firstColumnValue && firstColumnValue !== '') {
            // 번호와 이름 컬럼에서 값 가져오기
            const number = String(row[numberColumn] || row[firstColumn] || '').trim()
            const name = String(row[nameColumn] || '').trim()
            
            // 번호와 이름이 모두 있어야 학생으로 인식
            if (number && name && name !== '') {
              // 중복 체크 (같은 번호나 이름이 이미 있는지)
              const duplicate = parsedStudents.some(
                s => s.number === number || s.name === name
              )
              
              if (!duplicate) {
                parsedStudents.push({
                  id: `student-${studentIndex}`,
                  number: number,
                  name: name,
                })
                studentIndex++
              }
            }
          }
          // 그룹 B: 첫 번째 컬럼이 비어있고, 두 번째와 세 번째 컬럼에 텍스트가 있는 행
          else if (!firstColumnValue || firstColumnValue === '') {
            const secondValue = String(row[secondColumn] || '').trim()
            const thirdValue = String(row[thirdColumn] || '').trim()
            
            // 두 번째와 세 번째 컬럼에 모두 텍스트가 있어야 짝 금지로 인식
            if (secondValue && thirdValue && 
                secondValue !== '' && thirdValue !== '' &&
                !isNaN(secondValue) === false && !isNaN(thirdValue) === false) {
              
              // 학생 목록에서 해당 이름을 가진 학생 찾기
              const student1 = parsedStudents.find(s => s.name === secondValue)
              const student2 = parsedStudents.find(s => s.name === thirdValue)
              
              if (student1 && student2 && student1.id !== student2.id) {
                // 중복 체크
                const exists = parsedForbiddenPairs.some(
                  pair =>
                    (pair.student1Id === student1.id && pair.student2Id === student2.id) ||
                    (pair.student1Id === student2.id && pair.student2Id === student1.id)
                )
                
                if (!exists) {
                  parsedForbiddenPairs.push({
                    student1Id: student1.id,
                    student2Id: student2.id,
                  })
                }
              }
            }
          }
        })
        
        setStudents(parsedStudents)
        setForbiddenPairs(parsedForbiddenPairs)
      },
      error: (error) => {
        alert('CSV 파일을 읽는 중 오류가 발생했습니다: ' + error.message)
      }
    })
  }

  // 학생 추가
  const handleAddStudent = (number, name) => {
    const newStudent = {
      id: `student-${Date.now()}`,
      number: String(number),
      name: String(name).trim(),
    }
    setStudents([...students, newStudent])
  }

  // 학생 수정
  const handleUpdateStudent = (id, number, name) => {
    setStudents(students.map(s => 
      s.id === id ? { ...s, number: String(number), name: String(name).trim() } : s
    ))
  }

  // 학생 삭제
  const handleDeleteStudent = (id) => {
    setStudents(students.filter(s => s.id !== id))
    // 해당 학생의 짝 금지도 제거
    setForbiddenPairs(forbiddenPairs.filter(pair => 
      pair.student1Id !== id && pair.student2Id !== id
    ))
  }

  // 랜덤 배정 알고리즘
  const assignSeats = useCallback(() => {
    const layout = SEAT_LAYOUTS[seatLayout]
    
    if (students.length === 0) {
      alert('학생 명단을 먼저 입력해주세요.')
      return
    }

    // pair 레이아웃일 때는 pairsPerRow를 고려한 배정
    if (seatLayout === 'pair') {
      if (pairsPerRow < 1) {
        alert('한 줄에 배치할 분단 수는 1 이상이어야 합니다.')
        return
      }

      // 짝 금지 조건을 만족하는 배정 찾기 (최대 1000번 시도)
      let attempts = 0
      const maxAttempts = 1000
      
      while (attempts < maxAttempts) {
        // 1단계: 잠긴 자리에 있는 학생들 추출 및 고정 (고정석 확보)
        const lockedStudentsMap = new Map()
        seatAssignment.forEach((seat) => {
          const key = `${seat.row}-${seat.col}`
          if (lockedSeats.has(key) && seat.student) {
            lockedStudentsMap.set(key, seat.student)
          }
        })

        // 2단계: 잠기지 않은 나머지 좌석에 있던 학생들만 movableStudents로 추출
        const movableStudents = []
        seatAssignment.forEach((seat) => {
          const key = `${seat.row}-${seat.col}`
          if (!lockedSeats.has(key) && seat.student) {
            movableStudents.push(seat.student)
          }
        })

        // 3단계: 아직 자리를 못 잡은 대기 학생들도 movableStudents에 추가
        students.forEach(student => {
          const isLocked = Array.from(lockedStudentsMap.values()).some(s => s.id === student.id)
          const isAlreadyInMovable = movableStudents.some(s => s.id === student.id)
          if (!isLocked && !isAlreadyInMovable) {
            movableStudents.push(student)
          }
        })

        // 4단계: movableStudents를 랜덤으로 섞기
        const shuffled = [...movableStudents].sort(() => Math.random() - 0.5)
        
        // 5단계: newSeats 배열 생성, 잠긴 자리는 기존 학생 그대로 고정
        const newSeats = []
        let shuffledIndex = 0
        let valid = true

        // 필요한 행 수 계산
        const totalStudents = movableStudents.length + lockedStudentsMap.size
        const requiredRows = Math.ceil(totalStudents / (pairsPerRow * 2))
        
        // 모든 좌석을 생성: 잠긴 자리는 고정, 나머지는 빈 자리로 초기화
        for (let r = 0; r < requiredRows; r++) {
          for (let p = 0; p < pairsPerRow; p++) {
            const key1 = `${r}-${p * 2}`
            const key2 = `${r}-${p * 2 + 1}`
            
            // 첫 번째 좌석
            if (lockedSeats.has(key1)) {
              // 잠긴 자리: 기존 학생 그대로 고정
              newSeats.push({
                row: r,
                col: p * 2,
                student: lockedStudentsMap.get(key1) || null,
                pairIndex: p,
              })
            } else {
              // 잠기지 않은 빈자리: 나중에 채움
              newSeats.push({
                row: r,
                col: p * 2,
                student: null,
                pairIndex: p,
              })
            }
            
            // 두 번째 좌석
            if (lockedSeats.has(key2)) {
              // 잠긴 자리: 기존 학생 그대로 고정
              newSeats.push({
                row: r,
                col: p * 2 + 1,
                student: lockedStudentsMap.get(key2) || null,
                pairIndex: p,
              })
            } else {
              // 잠기지 않은 빈자리: 나중에 채움
              newSeats.push({
                row: r,
                col: p * 2 + 1,
                student: null,
                pairIndex: p,
              })
            }
          }
        }

        // 6단계: 잠기지 않은 빈자리에 섞인 학생들을 순서대로 채워넣기
        for (let i = 0; i < newSeats.length; i++) {
          if (!newSeats[i].student && shuffledIndex < shuffled.length) {
            newSeats[i].student = shuffled[shuffledIndex]
            shuffledIndex++
          }
        }

        // 7단계: 짝 금지 조건 검사
        for (const pair of forbiddenPairs) {
          const seat1 = newSeats.find(s => s.student?.id === pair.student1Id)
          const seat2 = newSeats.find(s => s.student?.id === pair.student2Id)
          
          if (seat1 && seat2) {
            // 같은 짝(pairIndex)에 있는지 확인
            if (seat1.row === seat2.row && seat1.pairIndex === seat2.pairIndex) {
              valid = false
              break
            }
            // 인접한 짝에 있는지 확인 (같은 행에서 인접한 pairIndex)
            if (seat1.row === seat2.row && Math.abs(seat1.pairIndex - seat2.pairIndex) === 1) {
              valid = false
              break
            }
          }
        }

        if (valid) {
          setSeatAssignment(newSeats)
          return
        }

        attempts++
      }

      // 조건을 만족하는 배정을 찾지 못한 경우
      console.log('Forbidden pair constraint failed after max attempts')
      alert('배치에 실패했습니다. 다시 시도해주세요.')
      return
    }

    // 일반 레이아웃 (5x5, 5x6, ㄷ자)
    if (colsPerRow < 1) {
      alert('한 줄에 배치할 열 수는 1 이상이어야 합니다.')
      return
    }

    // 1단계: 잠긴 자리에 있는 학생들 추출 및 고정 (고정석 확보)
    const lockedStudentsMap = new Map()
    seatAssignment.forEach((seat) => {
      const key = `${seat.row}-${seat.col}`
      if (lockedSeats.has(key) && seat.student) {
        lockedStudentsMap.set(key, seat.student)
      }
    })

    // 2단계: 잠기지 않은 나머지 좌석에 있던 학생들만 movableStudents로 추출
    const movableStudents = []
    seatAssignment.forEach((seat) => {
      const key = `${seat.row}-${seat.col}`
      if (!lockedSeats.has(key) && seat.student) {
        movableStudents.push(seat.student)
      }
    })

    // 3단계: 아직 자리를 못 잡은 대기 학생들도 movableStudents에 추가
    students.forEach(student => {
      const isLocked = Array.from(lockedStudentsMap.values()).some(s => s.id === student.id)
      const isAlreadyInMovable = movableStudents.some(s => s.id === student.id)
      if (!isLocked && !isAlreadyInMovable) {
        movableStudents.push(student)
      }
    })

    // 필요한 행 수 계산
    const totalStudents = movableStudents.length + lockedStudentsMap.size
    const requiredRows = Math.ceil(totalStudents / colsPerRow)
    const maxRows = 20 // 최대 행 수 제한

    if (requiredRows > maxRows) {
      alert(`학생 수가 너무 많습니다. 최대 ${maxRows * colsPerRow}명까지 배정 가능합니다.`)
      return
    }

    // 짝 금지 조건을 만족하는 배정 찾기 (최대 1000번 시도)
    let attempts = 0
    const maxAttempts = 1000
    
    while (attempts < maxAttempts) {
      // 4단계: movableStudents를 랜덤으로 섞기
      const shuffled = [...movableStudents].sort(() => Math.random() - 0.5)
      
      // 5단계: newSeats 배열 생성, 잠긴 자리는 기존 학생 그대로 고정
      const newSeats = []
      let shuffledIndex = 0
      let valid = true

      // ㄷ자 형태 특별 처리
      if (seatLayout === 'ㄷ자') {
        for (let row = 0; row < requiredRows; row++) {
          for (let col = 0; col < colsPerRow; col++) {
            const key = `${row}-${col}`
            // 잠긴 자리는 기존 학생 그대로 고정
            if (lockedSeats.has(key)) {
              newSeats.push({
                row,
                col,
                student: lockedStudentsMap.get(key) || null,
              })
            } else {
              // 잠기지 않은 빈자리: 나중에 채움
              newSeats.push({
                row,
                col,
                student: null,
              })
            }
          }
        }
      } else {
        // 일반 레이아웃: 사용자가 설정한 colsPerRow만큼 배정
        for (let row = 0; row < requiredRows; row++) {
          for (let col = 0; col < colsPerRow; col++) {
            const key = `${row}-${col}`
            // 잠긴 자리는 기존 학생 그대로 고정
            if (lockedSeats.has(key)) {
              newSeats.push({
                row,
                col,
                student: lockedStudentsMap.get(key) || null,
              })
            } else {
              // 잠기지 않은 빈자리: 나중에 채움
              newSeats.push({
                row,
                col,
                student: null,
              })
            }
          }
        }
      }

      // 6단계: 잠기지 않은 빈자리에 섞인 학생들을 순서대로 채워넣기
      // ㄷ자 형태의 경우 중간 행의 중간 열은 건너뜀
      for (let i = 0; i < newSeats.length; i++) {
        const seat = newSeats[i]
        
        if (seatLayout === 'ㄷ자') {
          // ㄷ자 형태: 첫 번째와 마지막 행은 전체 열 사용, 중간 행은 양쪽 끝만 사용
          if (seat.row === 0 || seat.row === requiredRows - 1) {
            // 전체 열 사용 - 빈 자리에 학생 배정
            if (!seat.student && shuffledIndex < shuffled.length) {
              seat.student = shuffled[shuffledIndex]
              shuffledIndex++
            }
          } else {
            // 중간 행: 양쪽 끝만 사용
            if ((seat.col === 0 || seat.col === colsPerRow - 1) && !seat.student && shuffledIndex < shuffled.length) {
              seat.student = shuffled[shuffledIndex]
              shuffledIndex++
            }
          }
        } else {
          // 일반 레이아웃: 모든 빈 자리에 학생 배정
          if (!seat.student && shuffledIndex < shuffled.length) {
            seat.student = shuffled[shuffledIndex]
            shuffledIndex++
          }
        }
      }

      // 7단계: 짝 금지 조건 검사
      for (const pair of forbiddenPairs) {
        const seat1 = newSeats.find(s => s.student?.id === pair.student1Id)
        const seat2 = newSeats.find(s => s.student?.id === pair.student2Id)
        
        if (seat1 && seat2) {
          // 인접한 좌석인지 확인
          const rowDiff = Math.abs(seat1.row - seat2.row)
          const colDiff = Math.abs(seat1.col - seat2.col)
          
          // 같은 행 또는 같은 열에서 인접한 경우 (거리 1)
          if ((rowDiff === 0 && colDiff === 1) || (rowDiff === 1 && colDiff === 0)) {
            valid = false
            break
          }
        }
      }

      if (valid) {
        setSeatAssignment(newSeats)
        return
      }

      attempts++
    }

    // 조건을 만족하는 배정을 찾지 못한 경우
    console.log('Forbidden pair constraint failed after max attempts')
    alert('배치에 실패했습니다. 다시 시도해주세요.')
  }, [students, seatLayout, forbiddenPairs, pairsPerRow, colsPerRow, lockedSeats, seatAssignment])

  // 좌석 배정 수동 업데이트 (드래그 앤 드롭용)
  const handleSeatUpdate = (fromRow, fromCol, toRow, toCol) => {
    const fromKey = `${fromRow}-${fromCol}`
    const toKey = `${toRow}-${toCol}`
    
    // 잠긴 자리는 이동 불가
    if (lockedSeats.has(fromKey) || lockedSeats.has(toKey)) {
      return
    }
    
    const newAssignment = [...seatAssignment]
    const fromIndex = newAssignment.findIndex(s => s.row === fromRow && s.col === fromCol)
    const toIndex = newAssignment.findIndex(s => s.row === toRow && s.col === toCol)
    
    if (fromIndex !== -1 && toIndex !== -1) {
      const temp = newAssignment[fromIndex].student
      newAssignment[fromIndex].student = newAssignment[toIndex].student
      newAssignment[toIndex].student = temp
      setSeatAssignment(newAssignment)
    }
  }

  // 좌석 잠금/해제
  const handleSeatLock = (row, col) => {
    const key = `${row}-${col}`
    const newLockedSeats = new Set(lockedSeats)
    
    if (newLockedSeats.has(key)) {
      newLockedSeats.delete(key)
    } else {
      newLockedSeats.add(key)
    }
    
    setLockedSeats(newLockedSeats)
  }

  // 이미지 다운로드 (A4 가로 사이즈)
  const handleDownloadImage = async () => {
    if (seatAssignment.length === 0) {
      alert('배정된 좌석이 없습니다.')
      return
    }

    if (!seatGridRef.current) {
      alert('좌석 배치도를 찾을 수 없습니다.')
      return
    }

    // 로딩 상태 시작
    setIsDownloading(true)

    try {
      // A4 가로 사이즈: 297mm x 210mm = 1123px x 794px (96 DPI 기준)
      // 더 높은 해상도를 위해 150 DPI 사용: 1654px x 1169px
      const a4Width = 1654
      const a4Height = 1169

      const element = seatGridRef.current

      // html2canvas 옵션 단순화 (안정성 우선)
      const options = {
        scale: 4,           // 고화질
        useCORS: true,      // 혹시 모를 이미지 이슈 방지
        backgroundColor: '#ffffff' // 배경색 흰색 고정
      }

      const canvas = await html2canvas(element, options)

      // A4 비율에 맞게 리사이즈
      const aspectRatio = a4Width / a4Height
      const canvasAspectRatio = canvas.width / canvas.height

      let finalWidth, finalHeight
      if (canvasAspectRatio > aspectRatio) {
        // 캔버스가 더 넓음 - 너비 기준
        finalWidth = a4Width
        finalHeight = a4Width / canvasAspectRatio
      } else {
        // 캔버스가 더 높음 - 높이 기준
        finalHeight = a4Height
        finalWidth = a4Height * canvasAspectRatio
      }

      // 새 캔버스 생성 (A4 사이즈)
      const finalCanvas = document.createElement('canvas')
      finalCanvas.width = a4Width
      finalCanvas.height = a4Height
      const ctx = finalCanvas.getContext('2d')

      // 흰색 배경
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, a4Width, a4Height)

      // 원본 이미지를 중앙에 배치
      const x = (a4Width - finalWidth) / 2
      const y = (a4Height - finalHeight) / 2
      ctx.drawImage(canvas, x, y, finalWidth, finalHeight)

      // PNG로 다운로드
      finalCanvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `자리배정_${new Date().toISOString().split('T')[0]}.png`)
        }
      }, 'image/png')
    } catch (error) {
      console.error('이미지 다운로드 오류:', error)
      alert('이미지 다운로드 중 오류가 발생했습니다.')
    } finally {
      // 성공하든 실패하든 반드시 로딩 상태 해제
      setIsDownloading(false)
    }
  }

  // CSV 다운로드
  const handleDownloadCSV = () => {
    if (seatAssignment.length === 0) {
      alert('배정된 좌석이 없습니다.')
      return
    }

    const csvData = []
    
    // 헤더 추가
    csvData.push(['행', '열', '번호', '이름'])
    
    // 좌석 배정 데이터 추가
    const maxRow = Math.max(...seatAssignment.map(s => s.row), 0)
    const cols = seatLayout === 'pair' ? pairsPerRow * 2 : colsPerRow
    
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col < cols; col++) {
        const seat = seatAssignment.find(s => s.row === row && s.col === col)
        if (seat && seat.student) {
          csvData.push([
            row + 1,
            col + 1,
            seat.student.number,
            seat.student.name
          ])
        }
      }
    }

    const csv = Papa.unparse(csvData)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `자리배정_${new Date().toISOString().split('T')[0]}.csv`)
  }

  // 학생 명단 CSV 다운로드
  const handleDownloadStudentList = () => {
    if (students.length === 0) {
      alert('학생 명단이 비어있습니다.')
      return
    }

    const csvData = [['번호', '이름']]
    students.forEach(student => {
      csvData.push([student.number, student.name])
    })

    const csv = Papa.unparse(csvData)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `학생명단_${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          🎉 신나는 자리바꾸기
        </h1>

        {/* 상단 컨트롤 패널 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                좌석 배치 형태
              </label>
              <select
                value={seatLayout}
                onChange={(e) => {
                  setSeatLayout(e.target.value)
                  setSeatAssignment([])
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="5x5">5x5 (25석)</option>
                <option value="5x6">5x6 (30석)</option>
                <option value="pair">2명씩 짝지어 앉기</option>
                <option value="ㄷ자">ㄷ자 형태 (30석)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {seatLayout === 'pair' 
                  ? '한 줄에 몇 분단(짝)을 배치할까요?'
                  : '한 줄에 몇 명(열)을 배치할까요?'
                }
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={seatLayout === 'pair' ? pairsPerRow : colsPerRow}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1
                  if (seatLayout === 'pair') {
                    setPairsPerRow(Math.max(1, Math.min(10, value)))
                  } else {
                    setColsPerRow(Math.max(1, Math.min(10, value)))
                  }
                  setSeatAssignment([])
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={assignSeats}
                className="w-full bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors font-medium"
              >
                🎲 자리 배정하기
              </button>
            </div>

            <div className="flex gap-2 items-end">
              <button
                onClick={handleDownloadImage}
                disabled={seatAssignment.length === 0 || isDownloading}
                className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <span className="text-base flex-shrink-0">📥</span>
                <span className="whitespace-nowrap">{isDownloading ? '다운로드 중...' : '배정 결과 다운로드'}</span>
              </button>
              <button
                onClick={handleDownloadStudentList}
                disabled={students.length === 0}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <span className="text-base flex-shrink-0">📋</span>
                <span className="whitespace-nowrap">명단 다운로드</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSV 파일 업로드
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 좌측: 학생 명단 관리 */}
          <div className="lg:col-span-1">
            <StudentList
              students={students}
              onAdd={handleAddStudent}
              onUpdate={handleUpdateStudent}
              onDelete={handleDeleteStudent}
            />
          </div>

          {/* 중앙: 좌석 배치 */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* 계층 1: 화면 배치용 (캡처되지 않음) */}
            <div className="w-full flex justify-center overflow-auto">
              {/* 계층 2: 캡처 타겟 (ref 연결) */}
              <div ref={seatGridRef} id="seat-grid-container" className="w-fit h-fit bg-white p-4 inline-flex gap-4">
                {/* 계층 3: 내용물 (창가 + 좌석 + 복도) */}
                <SeatGrid
                  layout={SEAT_LAYOUTS[seatLayout]}
                  seatLayout={seatLayout}
                  assignment={seatAssignment}
                  onSeatUpdate={handleSeatUpdate}
                  onSeatLock={handleSeatLock}
                  pairsPerRow={pairsPerRow}
                  colsPerRow={colsPerRow}
                  lockedSeats={lockedSeats}
                />
              </div>
            </div>

            {/* 교탁: 좌석 아래 배치 (교사 시점) */}
            <div className="flex justify-center">
              <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white px-12 py-4 rounded-lg shadow-md font-bold text-lg">
                🖥️ 교탁
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

