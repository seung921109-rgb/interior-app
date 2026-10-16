import FileUpload from "@/components/FileUpload"
import WorkArea from "@/components/WorkArea"

export default function UploadPage() {
  return (
    <WorkArea
      fill
      title="사진 업로드"
      description="가구를 터치하거나 테두리를 칠하면 비슷한 색 안쪽이 채워지고, 거친 경계는 스무딩됩니다."
    >
      <FileUpload />
    </WorkArea>
  )
}
