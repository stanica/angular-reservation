/**
 * Controller for directive
 * @author hmartos
 */
(function () {
    //Controller
    angular.module('hm.reservation').controller('ReservationCtrl', ['$scope', '$rootScope', '$filter', '$window', '$translate', 'reservationAPIFactory', 'reservationConfig', 'reservationService', 'Order', 'PaymentMethod', reservationCtrl]);

    function reservationCtrl($scope, $rootScope, $filter, $window, $translate, reservationAPIFactory, reservationConfig, reservationService, Order, PaymentMethod) {
        //Capture the this context of the Controller using vm, standing for viewModel
        var vm = this;

        vm.selectedTab = 0;
        vm.secondTabLocked = true;
        vm.thirdTabLocked = true;
        vm.showSummary = false;

        var today = new Date();
        today.setHours(0,0,0,0); //Date at start of today
        vm.selectedDate = today;

        vm.selectedHour = "";
        vm.selectedSlot = '';
        vm.details = "";
        vm.hold = "";
        vm.holdStatus = '';
        vm.holdStatusMessage = '';
        vm.total = 0; //Price total
        vm.totalSelectedPeople = 0; //Number of people
        vm.selectedPeople = false;

        vm.userData = {};

        vm.loader = false;

        vm.dateFormat = reservationConfig.dateFormat;

        vm.datepickerTemplate = reservationConfig.datepickerTemplate;
        vm.availableHoursTemplate = reservationConfig.availableHoursTemplate;
        vm.noAvailableHoursTemplate = reservationConfig.noAvailableHoursTemplate;
        vm.clientFormTemplate = reservationConfig.clientFormTemplate;

        vm.datepickerOptions = $scope.datepickerOptions;
        vm.apiKey = $scope.apiKey;
        vm.vendor = $scope.vendor;
        vm.id = $scope.id;
        vm.externalId = $scope.externalId;
        vm.product = $scope.product;
        vm.variant = $scope.variant;
        vm.user = $scope.user;

        $translate.use(reservationConfig.language);

        //METHODS
        // TODO This function should have all needed parameters in order to test it better
        vm.onSelectDate = function(date) {
            removeHold().then(function(result){
                ga('send', 'event', 'calendar-widget', 'next');
                vm.hold = '';
                vm.selectedDate = date;
                vm.secondTabLocked = false;
                vm.selectedTab = 1;
                $rootScope.scrollToAnchorMobile('calendar-top');
                onBeforeGetAvailableHours({apiKey: vm.apiKey, vendor: vm.vendor, id:vm.id, date:date, externalId: vm.externalId});
            });
        }

        vm.selectHour = function(time) {
            removeHold().then(function(result){
                ga('send', 'event', 'calendar-widget', 'select-hour');
                vm.hold = '';
                vm.loader = true;
                vm.selectedHour = new Date(time.startTime.replace('T', ' ').replace(/-/g,'/').slice(0, -6));
                vm.selectedHour = $filter('date')(vm.selectedHour,'shortTime');
                vm.selectedSlot = time;
                onBeforeHoldDate(time);
            });
        }

        vm.reserve = function(date, hour, userData) {
            //vm.showSummary = true;
            onBeforeReserve(date, hour, userData);
        }

        vm.setSummary = function(state){
            vm.showSummary = state;
            if(!state){
                vm.selectedTab = 0;
            }
            $rootScope.scrollToAnchorMobile('calendar-top');
        }


        vm.getDetails = function(){
            vm.loader = true;
            reservationAPIFactory.getDetails({apiKey: vm.apiKey, vendor: vm.vendor, id: vm.id, externalId: vm.externalId}).then(function(){
                vm.details = reservationAPIFactory.details;
                vm.loader = false;
            });
        }

        vm.getTotal = function(){
            var total = 0;
            for(var x=0; x<vm.details.length; x++){
                total += vm.details[x].selected * vm.details[x].price.amount;
            }
            return total;
        }

        vm.range = function(min, max, step) {
            step = step || 1;
            var input = [];
            for (var i = min; i <= max; i += step) {
                input.push(i);
            }
            return input;
        };

        //PRIVATE METHODS

        /**
         * Function executed before get available hours function.
         */
        function onBeforeGetAvailableHours(params) {
            /*
            reservationService.onBeforeGetAvailableHours(date).then(function () {
                getAvailableHours(date);

            }, function() {
                console.log("onBeforeGetAvailableHours: Rejected promise");
            });*/
            if(vm.vendor === 'bookeo'){
                var people = {};
                vm.totalSelectedPeople = 0;
                for(var x=0; x<vm.details.length; x++){
                    people[vm.details[x].id] = vm.details[x].selected;
                    vm.totalSelectedPeople += vm.details[x].selected
                }
                params.people = people;
            }
            vm.loader = true;
            vm.availableHours = '';
            getAvailableHours(params);
        }

        /**
         * Function executed before get holding time slot.
         */
        function onBeforeHoldDate(params){
            if(vm.vendor === 'bookeo'){
                var people = {};
                for(var x=0; x<vm.details.length; x++){
                    people[vm.details[x].id] = vm.details[x].selected;
                }
                params.people = people;
            }
            var selectedDateFormatted = $filter('date')(vm.selectedDate, vm.dateFormat);
            reservationAPIFactory.hodl({apiKey: vm.apiKey, vendor: vm.vendor, id:vm.id, date:selectedDateFormatted, externalId: vm.externalId, eventId:params.eventId, people:params.people}).then(function(data){
                if(reservationAPIFactory.hold.status === 'Error'){
                    vm.holdStatus = 'Error';
                    vm.holdStatusMessage = reservationAPIFactory.hold.message;
                    vm.loader = false;
                }
                else {
                    vm.selectedTab = 2;
                    vm.hold = reservationAPIFactory.hold;
                    //vm.userData.finalPrice = vm.hold.totalPayable.amount;
                    vm.loader = false;
                    vm.thirdTabLocked = false;
                }
            });
        }

        /**
         * Get available hours for a selected date
         */
        function getAvailableHours(params) {
            var selectedDateFormatted = $filter('date')(params.date, vm.dateFormat);
            params.date = selectedDateFormatted;

            reservationAPIFactory.getVendorAvailableHours(params).then(function (data) {
                vm.loader = false;

                var status = vm.availableHoursStatus = reservationAPIFactory.status || '';
                var message = vm.availableHoursMessage = reservationAPIFactory.message || '';

                //Completed get available hours callback
                //reservationService.onCompletedGetAvailableHours(status, message, date);

                vm.availableHours = reservationAPIFactory.availableHours.filter(function(item){
                    return item.numSeatsAvailable >= vm.totalSelectedPeople;
                });
                //Success
                if (status.toUpperCase() == 'SUCCESS') {
                    //vm.availableHours = reservationAPIFactory.availableHours;
                    //Successful get available hours callback
                    //reservationService.onSuccessfulGetAvailableHours(status, message, date, vm.availableHours);

                //Error
                } else {
                    //Error get available hours callback
                    //reservationService.onErrorGetAvailableHours(status, message, date);
                }
            });
        }

        /**
         * Function executed before reserve function
         */
        function onBeforeReserve(date, hour, userData) {
            var v = JSON.parse(vm.variant), product=JSON.parse(vm.product);
            //userData.finalPrice = vm.hold.totalPayable.amount;
            reservationService.onBeforeReserve(date, hour, userData).then(function (){
                $rootScope.cart.addItem({sku:v.experienceSku, businessId:product.businessId, name:v.name, slug:product.slug, mrp:v.mrp, price:v.price, quantity:1, image:v.image,category:product.category, currency:vm.hold.totalPayable.currency, partner:product},true, false);
                var shipping = {
                    afterTax: parseFloat(vm.hold.totalPayable.amount),
                    charge: 0,
                    couponAmount: 0,
                    more: 999999,
                    tax: (vm.hold.price.totalTaxes.amount / vm.hold.price.totalNet.amount).toFixed(3) !== 1 ? 
                        (vm.hold.price.totalTaxes.amount / vm.hold.price.totalNet.amount).toFixed(3) :
                        0,
                    total: parseFloat(vm.hold.price.totalNet.amount),
                    holdId: vm.hold.id
                };
                var people = [];
                for (var x=0; x<vm.details.length; x++){
                    if(vm.details[x].selected > 0){
                        people.push({
                            name: vm.details[x].name,
                            quantity: vm.details[x].selected,
                            price: vm.details[x].price.amount
                        });
                    }
                }
                var data = {
                    tax: parseFloat(shipping.tax) !== 0 ? (parseFloat(shipping.tax) + 1) : 0,
                    businessId:product.businessId,
                    currency:vm.hold.totalPayable.currency,
                    phone:userData.phone,
                    name:userData.firstName + ' ' + userData.lastName,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    payment:'Stripe',
                    items:$rootScope.cart.items,
                    shipping:shipping,
                    email: userData.email.toLowerCase(),
                    people: people,
                    entered: {
                        status: true,
                        date: Date.now(),
                        bookingDate: vm.selectedDate,
                        bookingTime: vm.selectedHour
                    }
                };
                Order.widget.save(data, function(data){
                    var obj = {};
                    obj.status = {};
                    obj.status.name = 'Bookeo Stripe Modal Incomplete';
                    obj.status.val = 150;
                    obj.phone = userData.phone;
                    Order.widget.updateStatus.update({id:data.transactionId}, obj);
                    var paymentMethod = {};
                    PaymentMethod.active.query().$promise.then(function(res){
                        for(var x=0; x<res.length; x++){
                            if(res[x].name === 'Stripe'){
                                paymentMethod = res[x];
                            }
                        }
                        $rootScope.cart.checkout({paymentMethod:paymentMethod, transactionId:data.transactionId, email:userData.email, currency:$rootScope.cart.items[0].currency, options: shipping},true, function(checkout){
                            if(checkout.status === 'Error'){
                                var status = vm.reservationStatus = checkout.status;
                                var message = vm.reservationMessage = checkout.message;
                            }
                            else {
                                if(checkout.status === 'succeeded'){
                                    reserve(date, hour, userData, data.transactionId);
                                }
                                else {
                                    var status = vm.reservationStatus = checkout.status;
                                    var message = vm.reservationMessage = checkout.message;
                                }
                            }
                        });
                    });
                }, function(err){
                    $scope.err = "There was an error confirming your purchase. Try refreshing the page or send us an email. Sorry about that!";
                });
                

            }, function() {
                console.log("onBeforeReserve: Rejected promise");
            });
        }

        function removeHold(){
            return reservationAPIFactory.cancelHold({apiKey: vm.apiKey, id: vm.hold.id, vendor: vm.vendor});
        }

        /**
         * Do reserve POST with selectedDate, selectedHour and userData as parameters of the call
         */
        // TODO This function should have all needed parameters in order to test it better
        function reserve(date, hour, userData, transactionId) {
            vm.loader = true;

            var selectedDateFormatted = $filter('date')(date, vm.dateFormat);
            var people = {};
            if(vm.vendor === 'bookeo'){
                for(var x=0; x<vm.details.length; x++){
                    people[vm.details[x].id] = {
                        selected: vm.details[x].selected,
                        price: vm.details[x].price.amount
                    };
                }
            }
            var params = {transactionId: transactionId, selectedDate: selectedDateFormatted, selectedHour: hour, userData: userData, holdId: vm.hold.id, timeSlot: vm.selectedSlot, apiKey: vm.apiKey, vendor: vm.vendor, id: vm.id, externalId: vm.externalId, people:people, title: vm.details[0].title};

            reservationAPIFactory.reserve(params).then(function () {
                vm.loader = false;

                var status = vm.reservationStatus = reservationAPIFactory.status;
                var message = vm.reservationMessage = reservationAPIFactory.message;

                //Completed reserve callback
                
                
                //Success
                if (status === 'Success') {
                    //Successful reserve calback
                    reservationService.onCompletedReserve(status, message, date, hour, userData);
                    $window.location ='/purchase-complete';

                //Error
                } else {
                    //Error reserve callback
                    reservationService.onErrorReserve(status, message, date, hour, userData);
                }
            });
        }
    }

})();