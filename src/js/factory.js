/**
 * Factory for reservation
 * @author hmartos
 */
(function() {
    function reservationAPIFactory($http, reservationConfig) {

        var reservationAPI = {};

        // Error details
        reservationAPI.status = "";
        reservationAPI.message = "";
        reservationAPI.details = "";
        reservationAPI.availableHours = "";
        reservationAPI.hold = "";


        //METHODS

        //Call to get product details
        reservationAPI.getDetails = function(params){
            return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.getDetailsUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                //console.log(response.data);

                reservationAPI.status = response.data.status;
                reservationAPI.details = response.data;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to get list of available hours
        reservationAPI.getAvailableHours = function(params) {
            return $http({
                method: 'GET',
                params: params,
                url: reservationConfig.getAvailableHoursAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                validateAvailableHoursResponseData(response.data);

                reservationAPI.status = response.data.status;
                reservationAPI.message = response.data.message;
                reservationAPI.availableHours = response.data.availableHours;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        reservationAPI.getVendorAvailableHours = function(params) {
            return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.getAvailableHoursAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                
                //validateAvailableHoursResponseData(response.data);

                reservationAPI.status = response.data.status || '';
                reservationAPI.message = response.data.message || '';
                reservationAPI.availableHours = response.data.data;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to create temporary hold before finalizing booking
        reservationAPI.hodl = function(params){
           return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.holdSlotAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                //console.log(response.data);
                reservationAPI.hold = response.data;
                //validateReserveResponseData(response.data);
                //reservationAPI.status = response.data.status;
                //reservationAPI.message = response.data.message;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to create temporary hold before finalizing booking
        reservationAPI.cancelHold = function(params){
           return $http({
                method: 'PUT',
                data: params,
                url: reservationConfig.holdSlotAPIUrl,
                responseType: 'json'

            }).then(function(response) {

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }

        //Call to do a reserve
        reservationAPI.reserve = function(params) {
            return $http({
                method: 'POST',
                data: params,
                url: reservationConfig.reserveAPIUrl,
                responseType: 'json'

            }).then(function(response) {
                //Success handler
                //console.log(response.data);
                validateReserveResponseData(response.data);
                reservationAPI.status = response.data.status;
                reservationAPI.message = response.data.message;

            }, function(response) {
                reservationAPI.errorManagement(response.status);
            });
        }


        //Error management function, handles different kind of status codes
        reservationAPI.errorManagement = function(status) {
            resetVariables();
            switch (status) {
                case 500: //Server error
                    reservationAPI.status = "SERVER_ERROR";
                    break;
                default: //Other error, typically connection error
                    reservationAPI.status = "CONNECTION_ERROR";
                    break;
            }
        }

        //Reset factory variables when an error occurred
        function resetVariables() {
            reservationAPI.status = "";
            reservationAPI.message = "";
            reservationAPI.availableHours = "";
        }

        //Validate if available hours response has expected keys
        function validateAvailableHoursResponseData(data) {
            if(!data.hasOwnProperty('status')) console.error("Get available hours response should have a 'status' key");
            if(!data.hasOwnProperty('message')) console.error("Get available hours response should have a 'message' key");
            if(!data.hasOwnProperty('availableHours')) console.error("Get available hours response should have a 'availableHours' key");
        }

        //Validate if reserve response has expected keys
        function validateReserveResponseData(data) {
            if(!data.hasOwnProperty('status')) console.error("Reserve response should have a 'status' key");
            if(!data.hasOwnProperty('message')) console.error("Reserve response should have a 'message' key");
        }


        return reservationAPI;
    }
    angular.module('hm.reservation').filter('ignoreTimeZone', function(){
      return function(val){
          var newDate = new Date(val.replace('T', ' ').slice(0, -6));
         return newDate;
      };
    });
    angular.module('hm.reservation').factory('reservationAPIFactory', ['$http', 'reservationConfig', reservationAPIFactory]);
})();