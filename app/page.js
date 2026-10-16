import FileUpload from "@/components/ClientFileUpload"
import WorkArea from "@/components/WorkArea"

export default function UploadPage() {
  return (
    <WorkArea
      fill
      title="사진 업로드"
      description="가구를 터치해 영역을 잡고, 잘못되면 영역 초기화 후 다시 지정하세요."
    >
      <FileUpload />
    </WorkArea>
  )
}
