// SiteBuilder/components/DocumentBuilder.tsx

type SiteDocument = {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName?: string;
};

type Props = {
  value: SiteDocument[];
  onChange: (docs: SiteDocument[]) => void;
};
