import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AlertDescription } from "@/components/ui/alert";

function AllTimeRecords(): JSX.Element {
  return (
    <>
      <PageHeader title="歴代記録" />
      <div className="container">
        <Alert>
          <AlertDescription>現在メンテナンス中です。しばらくお待ちください。</AlertDescription>
        </Alert>
      </div>
    </>
  );
}

export default AllTimeRecords;