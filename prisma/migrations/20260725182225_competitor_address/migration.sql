-- Add optional address to Competitor (disambiguates chains in the UI)
ALTER TABLE "Competitor" ADD COLUMN "address" TEXT;
