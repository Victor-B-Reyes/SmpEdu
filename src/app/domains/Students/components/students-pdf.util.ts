import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// Configuración de fuentes para evitar errores de importación inmutable y de vfs indefinido
if (pdfFonts) {
  const vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs || pdfFonts;
  (pdfMake as any).vfs = vfs;
}

export class StudentsPdfUtil {
  static generateStudentsListPDF(data: any[]) {
    const docDefinition: TDocumentDefinitions = {
      pageOrientation: 'landscape', // Establecer la orientación de la página a horizontal
      content: [
        { text: 'LISTADO DE ALUMNOS', style: 'header' },
        {
          table: {
            headerRows: 1,
            // Definimos anchos fijos de 11 para las 30 columnas de "palomear"
            widths: ['auto', '*', '*', ...Array(30).fill(11)], 
            body: [
              [
                { text: 'No.', style: 'tableHeader' },
                { text: 'Nombre', style: 'tableHeader' },
                { text: 'Apellidos', style: 'tableHeader' },
                ...Array.from({ length: 30 }, () => ({ text: '', style: 'tableHeader' })),
              ],
              ...data.map((item, index) => [
                (index + 1).toString(),
                item.firstName || '',
                item.lastName || '',
                ...Array(30).fill(''),
              ])
            ],
          },
          layout: {
            fillColor: (rowIndex: number) => {
              return (rowIndex === 0) ? null : (rowIndex % 2 === 0 ? '#f9fafb' : null);
            },
          }
        }
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#4f46e5', // Indigo-600
          alignment: 'center'
        }
      },
      defaultStyle: {
        fontSize: 8 // Reducimos un poco el tamaño general para ganar espacio
      }
    };

    return pdfMake.createPdf(docDefinition);
  }
}
