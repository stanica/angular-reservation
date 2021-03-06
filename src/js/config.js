/**
 * Provider for reservation module
 * @author hmartos
 */
(function() {
    angular.module('hm.reservation').provider('reservationConfig', [reservationConfigProvider]);

    function reservationConfigProvider() {

        var config = {
            getDetailsUrl: "http://localhost:8080/getDetails",
            getAvailableHoursAPIUrl: "http://localhost:8080/availableHours", //API url endpoint to load list of available hours
            holdSlotAPIUrl: "http://localhost:8080/hold", //API url endpoint to do a hold
            reserveAPIUrl: "http://localhost:8080/reserve", //API url endpoint to do a reserve
            dateFormat: "yyyy-MM-dd",
            language: "en",
            showConfirmationModal: true,
            datepickerTemplate: "datepicker.html",
            availableHoursTemplate: "availableHours.html",
            noAvailableHoursTemplate: "noAvailableHours.html",
            clientFormTemplate: "clientForm.html",
            confirmationModalTemplate: "confirmationModal.html",
        };

        //Public API for the provider
        return ({
            $get: function() {
                return config;
            },
            set: function (values) {
                angular.extend(config, values);
            }
        });

    }
})();