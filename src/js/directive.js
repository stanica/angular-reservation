/**
 * Reservation directive
 * @author hmartos
 */
(function() {
    //Directive
    angular.module('hm.reservation').directive('reservation', [function() {
        return {
            restrict: 'E',
            scope: {
                datepickerOptions: '=',
                apiKey: '@',
                vendor: '@',
                id: '@',
                externalId: '@',
                product: '@',
                variant: '@'

            },
            controller: 'ReservationCtrl',
            controllerAs: 'reservationCtrl',
            templateUrl: 'index.html'
        };
    }]);

})();