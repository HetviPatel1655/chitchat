//javascript
import React, { useRef, useEffect } from 'react';
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import { renderAsync } from "docx-preview";
import * as XLSX from "xlsx";

interface FilePreviewModalProps {
    isOpen: boolean;
    fileUrl: string | null;
    fileName: string | null;
    fileType: string | null; // Mime type or extension
    onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ isOpen, fileUrl, fileName, onClose }) => {
    const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
    const [htmlContent, setHtmlContent] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const docContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {

        if (isOpen && fileUrl) {
            setLoading(true);
            setError(null);
            setHtmlContent(null);

            const isDocx = fileName?.toLowerCase().endsWith('.docx');
            const isXlsx = fileName?.toLowerCase().match(/\.(xlsx|xls|csv)$/);

            fetch(fileUrl)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load file");
                    return res.blob();
                })
                .then(async blob => {
                    if (isDocx) {
                        setBlobUrl(null); // Clear previous blobUrl if any (for DocViewer)
                        if (docContainerRef.current) {
                            docContainerRef.current.innerHTML = ''; // Clear previous content
                            try {
                                await renderAsync(blob, docContainerRef.current, docContainerRef.current, {
                                    className: "docx-viewer", // class name for the wrapper
                                    inWrapper: true, // enables rendering of wrapper
                                    ignoreWidth: false, // disables rendering of width
                                    ignoreHeight: false, // disables rendering of height
                                    ignoreFonts: false, // disables fonts rendering
                                    breakPages: true, // enables page breaking on page breaks
                                    ignoreLastRenderedPageBreak: true, // disables page breaking on lastRenderedPageBreak elements
                                    experimental: false, // enables experimental features (may disappear at any time)
                                    trimXmlDeclaration: true, // if true, xml declaration will be removed from xml documents before parsing
                                    debug: false, // enables additional logging
                                });
                            } catch (err) {
                                console.error("Error rendering docx:", err);
                                setError("Failed to render document format.");
                            }
                        }
                    } else if (isXlsx) {
                        setBlobUrl(null);
                        if (docContainerRef.current) docContainerRef.current.innerHTML = ''; // Clear docx container
                        const arrayBuffer = await blob.arrayBuffer();
                        const wb = XLSX.read(arrayBuffer, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]]; // Read first sheet
                        const html = XLSX.utils.sheet_to_html(ws);
                        setHtmlContent(html);
                    } else {
                        const url = URL.createObjectURL(blob);
                        setBlobUrl(url);
                    }
                })
                .catch(err => {
                    console.error("Error fetching file for preview:", err);
                    setError("Failed to load document. Please try downloading it.");
                })
                .finally(() => setLoading(false));
        } else {
            setBlobUrl(null);
            setHtmlContent(null);
            if (docContainerRef.current) docContainerRef.current.innerHTML = '';
        }

        return () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [isOpen, fileUrl, fileName]);

    if (!isOpen || !fileUrl) return null;

    const docs = blobUrl ? [
        { uri: blobUrl, fileName: fileName || "Document", fileType: fileName?.split('.').pop() }
    ] : [];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-[90vw] h-[90vh] bg-white rounded-lg overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 bg-gray-900 border-b border-gray-700">
                    <h3 className="text-white font-medium truncate max-w-[80%]">{fileName || "Document Preview"}</h3>
                    <div className="flex gap-2">
                        <a
                            href={fileUrl}
                            download={fileName}
                            className="p-1.5 text-gray-400 hover:text-white bg-white/10 rounded-md transition-colors"
                            title="Download"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </a>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-md transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Viewer */}
                <div className="flex-1 overflow-auto bg-gray-100 relative p-4" style={{ minHeight: '300px' }}>

                    {/* Loading/Error State */}
                    {(loading || error) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            {loading && <div className="text-gray-500 font-medium bg-white/80 px-4 py-2 rounded">Loading document...</div>}
                            {error && <div className="text-red-500 font-medium bg-red-50 px-4 py-2 rounded-lg border border-red-200">{error}</div>}
                        </div>
                    )}

                    {/* Docx Preview Container */}
                    <div
                        ref={docContainerRef}
                        className={`mx-auto h-full ${!fileName?.toLowerCase().endsWith('.docx') ? 'hidden' : ''}`}
                        style={{ width: 'fit-content', minWidth: '100%', maxWidth: '100%', textAlign: 'left' }}
                    >
                    </div>

                    {/* Excel Preview Container */}
                    {!loading && !error && htmlContent && fileName?.toLowerCase().match(/\.(xlsx|xls|csv)$/) && (
                        <div className="mx-auto w-full max-w-[1200px] overflow-auto bg-white shadow p-4">
                            <style>{`
                                table { border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 14px; }
                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                th { background-color: #f3f4f6; font-weight: bold; }
                                tr:nth-child(even) { background-color: #f9f9f9; }
                                tr:hover { background-color: #f1f1f1; }
                            `}</style>
                            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                        </div>
                    )}

                    {/* Fallback DocViewer for non-docx/non-xlsx */}
                    {!loading && !error && blobUrl && !htmlContent && (
                        <div className="flex items-center justify-center min-h-full">
                            <DocViewer
                                documents={docs}
                                pluginRenderers={DocViewerRenderers}
                                style={{ height: '100%', width: '100%' }}
                                config={{
                                    header: {
                                        disableHeader: true,
                                        disableFileName: true,
                                        retainURLParams: false
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilePreviewModal;
