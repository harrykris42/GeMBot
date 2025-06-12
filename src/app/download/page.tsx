// This file runs server-side and immediately redirects to download the CSV file
import { redirect } from 'next/navigation';

export default function Page() {
  // The CSV URL you want to redirect to
  const fileUrl =
    'https://mkp.gem.gov.in/uploaded_documents/51/16/877/OrderItem/BoqLineItemsDocument/2025/5/13/boq_item_sample_file_-1_2025-05-13-21-35-46_9dcd22241e07562489add84f95610c26.csv';

  // Immediately redirect to trigger download
  redirect(fileUrl);
}
