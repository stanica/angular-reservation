//Module myApp
angular.module('myApp', [
    'ui.bootstrap',
    'pascalprecht.translate',
    'hm.reservation'
]);

//Configuration of reservation module
angular.module('myApp').config(function (reservationConfigProvider) {
    /*var config = {
        getAvailableHoursAPIUrl: "https://localhost:8080/availableHours", //API url endpoint to load list of available hours
        reserveAPIUrl: "https://localhost:8080/reserve", //API url endpoint to do a reserve
        language: "es",
        dateFormat: "dd/MM/yyyy",
        showConfirmationModal: true,
        clientFormTemplate: "partials/clientFormTemplate.html",
        confirmationModalTemplate: "partials/confirmModal.html"
    };

    reservationConfigProvider.set(config);*/
});

//Controller
angular.module('myApp').controller('MyCtrl', function (reservationService) {
    var vm = this;

    //Datepicker options
    vm.datepickerOptions = {
        minDate: new Date(),
        showWeeks: false
    }

});