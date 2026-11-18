# Synthetic local converter qualification. Run with the optional MarkItDown
# environment; on macOS also use sandbox-exec to deny native-library networking.
import zipfile, io, sys, json, time, importlib.metadata, pathlib
from markitdown import MarkItDown, StreamInfo
# Deny socket creation/connect in this process: local extraction only.
def audit(event,args):
 if event.startswith('socket.'): raise RuntimeError('Network unavailable in qualification')
sys.addaudithook(audit)
import tempfile
root=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(tempfile.mkdtemp(prefix='specdown-markitdown-'))
root.mkdir(parents=True, exist_ok=True)
ct='''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'''
rels='''<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'''
xml='''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Synthetic heading</w:t></w:r></w:p><w:p><w:r><w:t>Before </w:t></w:r><w:ins w:id="1" w:author="Synthetic"><w:r><w:t>INSERTED</w:t></w:r></w:ins><w:del w:id="2" w:author="Synthetic"><w:r><w:delText>DELETED</w:delText></w:r></w:del><w:r><w:t> after</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell one</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell two</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>'''
with zipfile.ZipFile(root/'synthetic.docx','w') as z:
 z.writestr('[Content_Types].xml',ct);z.writestr('_rels/.rels',rels);z.writestr('word/document.xml',xml)
# Minimal text-bearing PDF with explicit expected text.
stream=b'BT /F1 14 Tf 72 720 Td (Synthetic PDF heading) Tj 0 -28 Td (Expected paragraph text.) Tj ET'
objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream']
pdf=b'%PDF-1.4\n';offsets=[]
for i,obj in enumerate(objects,1): offsets.append(len(pdf));pdf+=f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n'
xref=len(pdf);pdf+=f'xref\n0 6\n0000000000 65535 f \n'.encode()+b''.join(f'{o:010} 00000 n \n'.encode() for o in offsets)+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
(root/'synthetic.pdf').write_bytes(pdf)
md=MarkItDown(enable_plugins=False)
results=[]
for name in ['synthetic.docx','synthetic.pdf']:
 start=time.monotonic()
 with open(root/name,'rb') as f: result=md.convert_stream(f,stream_info=StreamInfo(extension=pathlib.Path(name).suffix))
 text=result.markdown
 (root/(name+'.md')).write_text(text)
 results.append({'input':name,'seconds':round(time.monotonic()-start,3),'markdown':text,'tracked_change_rule':('INSERTED' in text and 'DELETED' not in text) if name.endswith('docx') else None})
print(json.dumps({'version':importlib.metadata.version('markitdown'),'results':results},indent=2))
