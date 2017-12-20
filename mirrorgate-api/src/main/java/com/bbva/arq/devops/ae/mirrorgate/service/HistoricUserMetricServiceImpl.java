package com.bbva.arq.devops.ae.mirrorgate.service;

import static com.bbva.arq.devops.ae.mirrorgate.mapper.HistoricUserMetricMapper.mapToHistoric;

import com.bbva.arq.devops.ae.mirrorgate.core.dto.DashboardDTO;
import com.bbva.arq.devops.ae.mirrorgate.dto.HistoricUserMetricDTO;
import com.bbva.arq.devops.ae.mirrorgate.mapper.HistoricUserMetricMapper;
import com.bbva.arq.devops.ae.mirrorgate.model.HistoricUserMetric;
import com.bbva.arq.devops.ae.mirrorgate.model.UserMetric;
import com.bbva.arq.devops.ae.mirrorgate.repository.HistoricUserMetricRepository;
import com.bbva.arq.devops.ae.mirrorgate.utils.LocalDateTimeHelper;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;


@Service
public class HistoricUserMetricServiceImpl implements HistoricUserMetricService {

    private static final Logger LOGGER = LoggerFactory.getLogger(HistoricUserMetricServiceImpl.class);
    private static final int MAX_NUMBER_OF_DAYS_TO_STORE = 90;

    private final HistoricUserMetricRepository historicUserMetricRepository;

    @Autowired
    public HistoricUserMetricServiceImpl(HistoricUserMetricRepository historicUserMetricRepository){

        this.historicUserMetricRepository = historicUserMetricRepository;
    }


    @Override
    public HistoricUserMetric createNextPeriod(UserMetric userMetric) {

        LOGGER.debug("creating new Historic Metric Period");

        HistoricUserMetric historicUserMetric = mapToHistoric(userMetric);

        historicUserMetric.setSampleSize(0d);
        historicUserMetric.setTimestamp(LocalDateTimeHelper.getTimestampPeriod(userMetric.getTimestamp(), ChronoUnit.HOURS));
        historicUserMetric.setValue(0d);

        return historicUserMetric;
    }


    @Override
    public void addToCurrentPeriod(Iterable<UserMetric> saved) {

        saved.forEach( s -> {
            try {
                HistoricUserMetric metric = getHistoricMetricForPeriod(
                    LocalDateTimeHelper.getTimestampPeriod(s.getTimestamp(), ChronoUnit.HOURS),
                    s.getId());

                if (metric == null) {
                    metric = createNextPeriod(s);
                }

                HistoricUserMetric addedMetric = addMetrics(metric, s);
                historicUserMetricRepository.save(addedMetric);
                removeExtraPeriodsForMetricAndIdentifier(MAX_NUMBER_OF_DAYS_TO_STORE,
                    metric.getName(), metric.getIdentifier());
            } catch (Exception e) {
                LOGGER.error("Error while processing metric : {}", s.getName(), e);
            }
        });
    }

    @Override
    public void removeExtraPeriodsForMetricAndIdentifier(int daysToKeep, String metricName, String identifier) {

        LOGGER.debug("removing extra periods for: {}, {}, {}", daysToKeep, metricName, identifier);

        List<HistoricUserMetric> oldPeriods = historicUserMetricRepository.findByNameAndIdentifierAndTimestampLessThan(metricName, identifier, LocalDateTimeHelper.getTimestampForNDaysAgo(daysToKeep, ChronoUnit.HOURS));

        historicUserMetricRepository.delete(oldPeriods);
    }

    @Override
    public List<HistoricUserMetricDTO> getHistoricMetricsForDashboard(DashboardDTO dashboard, String metricName, int numberOfResults) {
        List<String> views = dashboard.getAnalyticViews();

        if (views == null || views.isEmpty()) {
            return new ArrayList<>();
        }

        return historicUserMetricRepository.findAllByViewIdInAndValueGreaterThanAndNameOrderByTimestampAsc
            (new PageRequest(0, numberOfResults), views, 0d, metricName)
            .stream().map(HistoricUserMetricMapper::map)
            .collect(Collectors.toList());
    }

    @Override
    public HistoricUserMetric getHistoricMetricForPeriod(long periodTimestamp, String identifier) {

        return historicUserMetricRepository.findByTimestampAndIdentifier(periodTimestamp, identifier);
    }

    private HistoricUserMetric addMetrics (final HistoricUserMetric historic, final UserMetric saved){

        HistoricUserMetric response =  historic;

        if(saved.getSampleSize() != null){
            double value = (historic.getValue()*historic.getSampleSize()+saved.getValue()*saved.getSampleSize())/(historic.getSampleSize()+saved.getSampleSize());
            response.setValue(value);
            response.setSampleSize(response.getSampleSize()+saved.getSampleSize());
        } else {
            response.setValue(response.getValue() + saved.getValue());
        }

        return response;
    }

}
