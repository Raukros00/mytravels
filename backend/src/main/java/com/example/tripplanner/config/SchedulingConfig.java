package com.example.tripplanner.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Attiva i job pianificati (@Scheduled), es. i promemoria prima della partenza (#99). */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
