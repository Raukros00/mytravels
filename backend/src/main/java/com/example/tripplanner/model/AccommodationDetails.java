package com.example.tripplanner.model;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class AccommodationDetails {
    @Column(name = "accom_name")  private String name;
    @Column(name = "accom_address", columnDefinition = "text") private String address;

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "lat", column = @Column(name = "accom_lat")),
        @AttributeOverride(name = "lng", column = @Column(name = "accom_lng"))
    })
    private GeoPoint coordinates;

    @Column(name = "accom_check_in_date")    private String checkInDate;
    @Column(name = "accom_check_in_time")    private String checkInTime;
    @Column(name = "accom_check_out_date")   private String checkOutDate;
    @Column(name = "accom_check_out_time")   private String checkOutTime;
    @Column(name = "accom_booking_code")     private String bookingCode;
    @Column(name = "accom_phone_or_contact") private String phoneOrContact;
    @Column(name = "accom_notes", columnDefinition = "text") private String notes;
}
