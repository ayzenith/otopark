-- AddForeignKey
ALTER TABLE "WashJob" ADD CONSTRAINT "WashJob_vehicleClassId_fkey" FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

