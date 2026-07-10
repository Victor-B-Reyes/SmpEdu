import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// Configuración de fuentes para evitar errores de importación inmutable y de vfs indefinido
if (pdfFonts) {
  const vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs || pdfFonts;
  (pdfMake as any).vfs = vfs;
}

export class SchedulePdfUtil {
  static generateSchedulePDF(
    semesterName: string,
    grade: any,
    group: string,
    visibleDays: any[], // [{name: string, index: number}]
    slots: any[],       // [{label: string, endLabel: string}]
    getOffersForSlot: (di: number, si: number) => any[],
    getTeacherName: (id: any) => string
  ) {
    console.log('📄 Generando definición para:', { semesterName, grade, group });
    const docDefinition: TDocumentDefinitions = {
      pageOrientation: 'landscape',
      content: [
        { text: `HORARIO DE CLASES`, style: 'header' },
        { 
          text: `Ciclo: ${semesterName} | Grado: ${grade}° | Grupo: ${group}`, 
          style: 'subheader' 
        },
        {
          table: {
            headerRows: 1,
            // La primera columna (hora) es automática, el resto se reparte proporcionalmente
            widths: ['auto', ...visibleDays.map(() => '*')],
            body: [
              // Encabezado: HORA | LUNES | MARTES ...
              [
                { text: 'HORA', style: 'tableHeader' },
                ...visibleDays.map(day => ({ text: day.name.toUpperCase(), style: 'tableHeader' }))
              ],
              // Filas de tiempo (slots)
              ...slots.map((slot, si) => [
                { text: `${slot.label}\n-\n${slot.endLabel}`, style: 'timeSlotCell' },
                ...visibleDays.map((_, di) => {
                  const items = getOffersForSlot(di, si);
                  if (!items || items.length === 0) return { text: '' };

                  // Si hay múltiples materias en el mismo slot (conflictos), las apilamos con stack
                  return {
                    stack: items.flatMap(item => [
                      { text: item.label || 'Materia sin nombre', style: 'subjectName' },
                      { 
                        text: `Aula: ${item.classroom || 'N/A'}`, 
                        style: 'itemDetail' 
                      },
                      { 
                        text: item.teacherId ? getTeacherName(item.teacherId) : 'Sin docente', 
                        style: 'teacherName' 
                      }
                    ]),
                    margin: [2, 4, 2, 4] as [number, number, number, number]
                  };
                })
              ])
            ]
          },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === (node.table.body?.length || 0)) ? 2 : 1,
            vLineWidth: (i, node) => (i === 0 || i === (node.table.widths?.length || 0)) ? 2 : 1,
            hLineColor: (i) => i === 0 ? '#4f46e5' : '#e2e8f0',
            vLineColor: (i) => '#e2e8f0',
            fillColor: (rowIndex) => {
              if (rowIndex === 0) return '#4f46e5'; // Indigo header
              return (rowIndex % 2 === 0) ? '#f8fafc' : null; // Zebra stripes
            }
          }
        }
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 5] as [number, number, number, number],
          color: '#1e293b'
        },
        subheader: {
          fontSize: 12,
          alignment: 'center',
          margin: [0, 0, 0, 20] as [number, number, number, number],
          color: '#64748b',
          bold: true
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          alignment: 'center',
          margin: [0, 5, 0, 5] as [number, number, number, number]
        },
        timeSlotCell: {
          fontSize: 8,
          bold: true,
          alignment: 'center',
          color: '#4f46e5',
          margin: [0, 5, 0, 5] as [number, number, number, number]
        },
        subjectName: {
          fontSize: 9,
          bold: true,
          color: '#1e293b'
        },
        itemDetail: {
          fontSize: 7,
          color: '#475569'
        },
        teacherName: {
          fontSize: 7,
          italics: true,
          color: '#94a3b8'
        }
      }
    };

    return pdfMake.createPdf(docDefinition);
  }
}