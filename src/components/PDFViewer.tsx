import { X, Download, Printer, Link2, Check } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../lib/auth'

interface PDFViewerProps {
  jobId: string
  onClose: () => void
}

export default function PDFViewer({ jobId, onClose }: PDFViewerProps) {
  const { session } = useAuth()
  const [copied, setCopied] = useState(false)
  const apiUrl = import.meta.env.VITE_API_URL
  const pdfUrl = `${apiUrl}/pdf/${jobId}?token=${session?.access_token}`

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `job-${jobId}.pdf`
    link.click()
  }

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-iframe') as HTMLIFrameElement
    if (iframe?.contentWindow) {
      iframe.contentWindow.print()
    } else {
      window.open(pdfUrl, '_blank')
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pdfUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
        style={{ height: '90vh' }}>
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ backgroundColor: '#07152B' }}
        >
          <span className="text-white font-semibold text-sm">Job Report — #{jobId}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              {copied ? <Check size={14} /> : <Link2 size={14} />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#FF6B00' }}
            >
              <Download size={14} />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors ml-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PDF iframe */}
        <div className="flex-1 bg-gray-100">
          <iframe
            id="pdf-iframe"
            src={pdfUrl}
            className="w-full h-full border-0"
            title={`Job ${jobId} PDF`}
          />
        </div>
      </div>
    </div>
  )
}
